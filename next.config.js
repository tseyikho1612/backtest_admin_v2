module.exports = {
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
    },
    async redirects() {
      return [
        {
          source: '/',
          destination: '/DataCleaning',
          permanent: true,
        },
      ];
    },
  };