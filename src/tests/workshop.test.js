import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workshop CTA routes to the in-app workshop and is not disabled", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /href="#workshop"[^>]*>Register &amp; Get Unlimited Upload Credits<\/a>/);
  assert.doesNotMatch(html, /href="#workshop"[^>]*disabled/);
  assert.match(html, /data-route="workshop"/);
  assert.match(html, />Register for the Free Workshop<\/button>/);
});

test("workshop registration has a separate demo page and does not submit data", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../robot-preview.js", import.meta.url), "utf8");
  assert.match(html, /data-route="workshop-register"/);
  assert.match(html, /href="\/workshop">/);
  assert.match(html, /id="workshopDemoForm"/);
  assert.match(source, /\/workshop\/register/);
  assert.match(source, /No real registration was created/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.doesNotMatch(source, /fetch\(|navigator\.sendBeacon/);
});

test("main navigation and workshop back links cover create, gallery, leaderboard, and about routes", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /href="#create"[^>]*>Create</);
  assert.match(html, /href="#gallery"[^>]*>Gallery</);
  assert.match(html, /href="#leaderboard"[^>]*>Leaderboard</);
  assert.match(html, /href="#about"[^>]*>About</);
  assert.match(html, /Back to NxtWave's Doodles/);
  assert.match(html, /Back to Workshop/);
});

test("the image placement prompt instructs clicking the robot", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /Click anywhere on the robot to attach the image/);
  assert.doesNotMatch(html, />Drag image</);
});

test("registration rocket is centered relative to its grid card layout", async () => {
  const css = await readFile(new URL("../styles/community.css", import.meta.url), "utf8");
  assert.match(css, /\.workshop-register-layout \{[^}]*align-items:center;/s);
  assert.match(css, /\.registration-doodle \{[^}]*place-self:center;/s);
});
