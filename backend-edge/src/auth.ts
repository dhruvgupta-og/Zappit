import { Context, Next } from 'hono';
import * as jose from 'jose';
import { getPrisma } from './db';

const FIREBASE_PROJECT_ID = 'zappit-90a73';
const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface AuthUser {
  uid: string;
  email: string;
  role: string;
  staff_store_id?: string | null;
  staff_college_id?: string | null;
  staff_name?: string | null;
  staff_store_name?: string | null;
  staff_college_name?: string | null;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized: No token provided' }, 401);
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const { payload } = await jose.jwtVerify(token, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = payload.sub as string;
    const email = (payload.email as string) || '';

    const prisma = getPrisma(c.env.DB);
    const [dbUser, staffData] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.staff.findUnique({
        where: { id: uid },
        include: { store: true, college: true },
      }),
    ]);

    if (dbUser && dbUser.isBlocked) {
      return c.json({ success: false, error: 'Forbidden: Account blocked' }, 403);
    }

    let role = dbUser?.role || 'user';
    let staffStoreId: string | null = null;
    let staffCollegeId: string | null = null;
    let staffName: string | null = null;
    let staffStoreName: string | null = null;
    let staffCollegeName: string | null = null;

    if (role !== 'admin' && staffData) {
      role = staffData.role || role;
      staffStoreId = staffData.storeId;
      staffCollegeId = staffData.collegeId;
      staffName = staffData.name;
      staffStoreName = staffData.store?.name || null;
      staffCollegeName = staffData.college?.name || null;
    }

    const authUser: AuthUser = {
      uid,
      email,
      role,
      staff_store_id: staffStoreId,
      staff_college_id: staffCollegeId,
      staff_name: staffName,
      staff_store_name: staffStoreName,
      staff_college_name: staffCollegeName,
    };

    c.set('user', authUser);
    await next();
  } catch (err: any) {
    console.error('Auth verification error:', err.message);
    return c.json({ success: false, error: 'Unauthorized: Invalid token' }, 401);
  }
}

