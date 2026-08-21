import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit/exceljs pull dynamic data files — keep outside the bundler
  serverExternalPackages: [
    "pdfkit",
    "exceljs",
    "fontkit",
    "jpeg-exif",
    "playwright",
    "axe-core",
  ],
};

export default nextConfig;
