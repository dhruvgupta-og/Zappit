import { Hono } from 'hono';
import { getPrisma } from '../db';
import { AuthUser } from '../auth';

const users = new Hono<{ Bindings: { DB: D1Database }; Variables: { user: AuthUser } }>();

// GET /api/users/me/staff
users.get('/me/staff', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  return c.json({
    success: true,
    role: user.role,
    store_id: user.staff_store_id || null,
    store_name: user.staff_store_name || null,
    college_id: user.staff_college_id || null,
    college_name: user.staff_college_name || null,
    name: user.staff_name || null,
  });
});

// GET /api/users/:uid
users.get('/:uid', async (c) => {
  try {
    const user = c.get('user');
    const uid = c.req.param('uid');

    if (user.uid !== uid && user.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden: You can only access your own profile' }, 403);
    }

    const prisma = getPrisma(c.env.DB);
    const dbUser = await prisma.user.findUnique({ where: { id: uid } });

    if (!dbUser) {
      return c.json({ success: true, user: null, exists: false });
    }

    const profileComplete = dbUser.profileComplete !== false && !!(dbUser.phone && dbUser.collegeId);

    const userObj = {
      id: dbUser.id,
      _id: dbUser.id,
      uid: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: dbUser.role,
      college: dbUser.collegeName,
      college_id: dbUser.collegeId,
      college_name: dbUser.collegeName,
      collegeName: dbUser.collegeName,
      address: dbUser.address,
      profile_complete: profileComplete,
      profileComplete: profileComplete,
      auth_method: 'google',
      expoPushToken: dbUser.expoPushToken,
      fcmToken: dbUser.fcmToken,
      usedCoupons: JSON.parse(dbUser.usedCoupons || '[]'),
      isBlocked: dbUser.isBlocked,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };

    return c.json({ success: true, user: userObj, exists: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/users/:uid
users.post('/:uid', async (c) => {
  try {
    const user = c.get('user');
    const uid = c.req.param('uid');

    if (user.uid !== uid && user.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden: You can only access your own profile' }, 403);
    }

    const body = await c.req.json();
    const prisma = getPrisma(c.env.DB);

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.college_id !== undefined) updateData.collegeId = body.college_id;
    if (body.collegeId !== undefined) updateData.collegeId = body.collegeId;
    if (body.collegeName !== undefined) updateData.collegeName = body.collegeName;
    if (body.college_name !== undefined) updateData.collegeName = body.college_name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.expoPushToken !== undefined) updateData.expoPushToken = body.expoPushToken;
    if (body.fcmToken !== undefined) updateData.fcmToken = body.fcmToken;
    if (body.profile_complete !== undefined) updateData.profileComplete = !!body.profile_complete;
    if (body.profileComplete !== undefined) updateData.profileComplete = !!body.profileComplete;
    if (body.phone && (body.college_id || body.collegeId)) {
      updateData.profileComplete = true;
    }

    if (user.role === 'admin') {
      if (body.role !== undefined) updateData.role = body.role;
      if (body.isBlocked !== undefined) updateData.isBlocked = body.isBlocked;
    }

    const saved = await prisma.user.upsert({
      where: { id: uid },
      create: {
        id: uid,
        email: body.email || user.email || '',
        name: body.name || '',
        phone: body.phone || '',
        collegeId: body.college_id || body.collegeId || null,
        collegeName: body.collegeName || body.college_name || null,
        address: body.address || null,
        expoPushToken: body.expoPushToken || null,
        fcmToken: body.fcmToken || null,
        profileComplete: body.profile_complete !== undefined ? !!body.profile_complete : true,
        role: user.role === 'admin' && body.role ? body.role : 'user',
        isBlocked: false,
      },
      update: updateData,
    });

    const isComplete = saved.profileComplete !== false && !!(saved.phone && saved.collegeId);

    const userObj = {
      id: saved.id,
      _id: saved.id,
      uid: saved.id,
      name: saved.name,
      email: saved.email,
      phone: saved.phone,
      role: saved.role,
      college: saved.collegeName,
      college_id: saved.collegeId,
      college_name: saved.collegeName,
      collegeName: saved.collegeName,
      address: saved.address,
      profile_complete: isComplete,
      profileComplete: isComplete,
      auth_method: 'google',
      expoPushToken: saved.expoPushToken,
      fcmToken: saved.fcmToken,
      usedCoupons: JSON.parse(saved.usedCoupons || '[]'),
      isBlocked: saved.isBlocked,
    };

    return c.json({ success: true, user: userObj });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default users;

