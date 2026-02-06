/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@vicaper/contracts",
    "@vicaper/domain",
    "@vicaper/infra-supabase",
    "@vicaper/events",
    "@vicaper/observability",
  ],
};

module.exports = nextConfig;
