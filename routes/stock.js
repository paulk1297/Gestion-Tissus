const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { getStockNonCousu, getStockCousu } = require('../utils/stock');

const router = express.Router();

router.get(
  '/non-cousu',
  asyncHandler(async (req, res) => {
    const stock = await getStockNonCousu(pool);
    res.render('stock-non-cousu', { stock });
  })
);

router.get(
  '/cousu',
  asyncHandler(async (req, res) => {
    const stock = await getStockCousu(pool);
    res.render('stock-cousu', { stock });
  })
);

module.exports = router;
