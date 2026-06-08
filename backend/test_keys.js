const Razorpay = require('razorpay');

const rzp = new Razorpay({
  key_id: 'rzp_test_SoXpJa8UzBBORy',
  key_secret: 'NqsY11XYIv1vk6uZcVuLleh9'
});

rzp.orders.create({ amount: 1000, currency: 'INR', receipt: 'test' })
  .then(order => {
    console.log("SUCCESS with OLD keys:", order.id);
  })
  .catch(err => {
    console.log("FAILED with OLD keys:", err.error.description);
  });

const rzpNew = new Razorpay({
  key_id: 'rzp_test_SzDEnrukvzc7JY',
  key_secret: '6E0i2R051QMfCwwoB5tBf82y'
});

rzpNew.orders.create({ amount: 1000, currency: 'INR', receipt: 'test' })
  .then(order => {
    console.log("SUCCESS with NEW keys:", order.id);
  })
  .catch(err => {
    console.log("FAILED with NEW keys:", err.error.description);
  });
