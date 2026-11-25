import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { takeGoogleCallback } from "./services/googleAuth.js";
import { takeGooglePasswordCallback } from "./services/googlePassword.js";
import "./style.css";
import "./movie-details.css";
import "./panels.css";

const googlePasswordCallback = takeGooglePasswordCallback();
const googleCallback = takeGoogleCallback();
createRoot(document.getElementById("root")).render(
    <StrictMode><App googleCallback={googleCallback} googlePasswordCallback={googlePasswordCallback} /></StrictMode>
);
