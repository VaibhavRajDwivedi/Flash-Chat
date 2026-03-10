import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";

import { ENV } from "./env.js";

const aj = arcjet({
  key: ENV.ARCJET_KEY,
  rules: [
    // Mitigates baseline vulnerabilities.
    shield({ mode: "LIVE" }),
    // Configures automated traffic filtering.
    detectBot({
      mode: "LIVE", // Enforces strict blocking.
      // Whitelists allowed actors.
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Permits indexers.
        // Disabled monitoring and preview agents.
      ],
    }),
    // Enforces sliding window constraints.
    slidingWindow({
      mode: "LIVE", // Enforces strict blocking.
      max: 100,
      interval: 60,
    }),
  ],
});

export default aj;