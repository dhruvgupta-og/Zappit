const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ msg: 'Store routes placeholder' }));

module.exports = router;
