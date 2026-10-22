# Sketch School

A kid-friendly app that teaches realistic pencil drawing **on paper**. Every lesson is an animated demo that draws one step, pauses, and waits for "Tap when you've drawn this step ▶". Lessons unlock one at a time.

Live: https://karthikvepuriphoto-gif.github.io/sketch-school/

- `index.html`, `style.css`, `app.js`: the app (no build step)
- `lessons.js`: all lesson demos, generated as pencil strokes with pressure (original content)
- `videos.json`: starter video allowlist for parent review (steps are placeholders unless noted)

## Credits and licenses
- All code, lesson demos and illustrations are original to this project. No third-party libraries are bundled.
- Graphite rendering: custom stamp-based brush (grain textures generated at runtime).
- Videos play through the official YouTube IFrame Player API (youtube-nocookie.com) and the Vimeo Player API, loaded from their servers under their terms. Video content belongs to its creators.
- Teaching approach draws on well-established methods: Betty Edwards' *Drawing on the Right Side of the Brain* exercises (blind contour, upside-down drawing, negative space), the value scale and the 5 elements of shading, sight-size measuring, and 1- and 2-point perspective.
- "Storybook eyes" lessons are inspired by the style of Alvin Adhi, illustrator of *be Colorless*. The demos are original and don't copy his artwork.
- Character videos are official tutorials from Disney Parks, Walt Disney Animation Studios, Marvel Entertainment and DC Kids. The app never redraws copyrighted characters.
