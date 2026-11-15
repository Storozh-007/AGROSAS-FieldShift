# Water × Energy — farmer decision workflow

The primary task is to determine whether the available water, power and equipment can support a user-selected irrigation target over the next 72 hours. The app combines the actual ECMWF forecast with the saved infrastructure plan, exposes water and power shortages, groups feasible work windows, saves an action, and accepts a user-reported result. It does not operate real irrigation hardware or infer an agronomic prescription from a map colour.

The default farm screen opens on the decision workflow. The digital twin and satellite evidence are separate task views. Scenario parameters are behind disclosures; equipment uses bounded numeric inputs. A first-time field can initialize an explicitly planned irrigation circuit without overwriting existing equipment. Energy savings are shown as comparable only when delivered water is equivalent.

The field chooser is closed by default. Its regional filters, search and geometry cards replace the permanent orbit list. The Soniachne demonstration field was deleted from local and Docker databases; seeding now creates a workspace without recreating that boundary.

Educational farm overpasses follow a straight track with a footprint clipped to the field directly beneath the spacecraft. The official Landsat 8 model is used for this demonstration. A separate UTC mode uses SGP4 and displays a position marker only when its geolocation is actually near the local scene. It does not render a fabricated scan beam. Heights and playback time in the educational view are compressed.

Mission pages contain official 3D assets where available, credited photographs otherwise, a visible playable video example, and a selectable explanation of observation → data → farm decision. Generic glowing cones and invented substitute spacecraft were removed. Media sources and credits are recorded in the mission catalogue.

Release images reuse the validated backend dependency layer and the locally verified Next.js standalone production artifact. Environment files are excluded from the packaged frontend. The normal repository Dockerfiles remain available for full clean builds.

Verification (14 November 2026): Next.js production build and TypeScript passed; 26 unit tests passed. Chromium checks through the Docker gateway cover field selection/filtering, crop editing, cable isolation, moving/paused scan footprint, official-photo fallback, actual video playback, forecast→saved task→reported outcome, mobile widths and Retina rendering. A legacy journal CSS selector was updated to the new task status card and its scenario passed on retry.
The final mobile check also detected a toolbar wrapping issue after replacing the native selector; the toolbar now wraps its statistics below the chooser on small screens. Both affected legacy scenarios were rerun through the gateway after updating the task-card selector and mobile layout.
