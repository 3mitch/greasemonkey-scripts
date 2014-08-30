Pixelator
====================

For use on http://www.pixelator.co

Some demo functions to interact with the canvas in a scripted way.

When the webpage loads, you will see a few demo menu items to the right of the canvas.

It's best to start with a new canvas, vs working on the main shared homepage canvas.  The issue with the homepage canvas is that it has been completely filled in,
so running the clear canvas or color blue funcitons will take a long while to run.  (there is also a bug on pixelator that adds pixels outside of the rendering area,
and there are a number of them on the homepage canvas)

Due to the nature of pixelator's websocket connection/server processing, sometimes pixels will get lost in transit.  When this happens, just re-run the function and usually
they will get picked up on the next cycle.
