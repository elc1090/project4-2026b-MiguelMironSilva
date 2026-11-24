import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { takeGoogleCallback } from "./services/googleAuth.js";
import "./style.css";
import "./movie-details.css";
import "./panels.css";

const googleCallback = takeGoogleCallback();
createRoot(document.getElementById("root")).render(
    <StrictMode><App googleCallback={googleCallback} /></StrictMode>
);
