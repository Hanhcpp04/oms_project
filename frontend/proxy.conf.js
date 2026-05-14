module.exports = [
  {
    context: ['/vn-provinces'],
    target: 'https://provinces.open-api.vn',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/vn-provinces': '' }
  }
];
