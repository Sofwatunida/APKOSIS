/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Simpan RSC payload halaman sebentar di client router cache. Perpindahan
    // antar fitur yang sudah pernah dibuka menjadi instan; data tetap
    // di-refresh setelah aksi (router.refresh) atau saat cache kedaluwarsa.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

module.exports = nextConfig;
