import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "eval/**"],
  },
  {
    // Template-shipped components predate the React-compiler-era hook rules;
    // quarantine them there so lint stays enforceable for our own code.
    files: [
      "src/components/tambo/**",
      "src/app/interactables/components/**",
    ],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default eslintConfig;
