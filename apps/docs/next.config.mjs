import nextra from "nextra";

const withNextra = nextra({});

export default withNextra({
  // ESLint runs as its own turbo task, not inside next build.
  eslint: { ignoreDuringBuilds: true },
});
