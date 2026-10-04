import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import "./content.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

async function mount() {
  let app = <App />;

  // Flute's scene library, reachable at `?flute-preview=1`. The DEV check is a
  // compile-time constant, so production builds drop the import entirely.
  if (import.meta.env.DEV) {
    // Reward moments on demand, for working on them without finishing a challenge.
    const moments = await import("./lib/moments");
    Object.assign(window, { __gg: moments });
    const { FluteProjectPreview } = await import("./flute/ProjectPreview");
    app = (
      <FluteProjectPreview enabled hot={import.meta.hot}>
        {app}
      </FluteProjectPreview>
    );
  }

  root.render(<React.StrictMode>{app}</React.StrictMode>);
}

void mount();
