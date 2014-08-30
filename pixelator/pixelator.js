// ==UserScript==
// @name        Pixelator Play
// @namespace   https://github.com/3mitch
// @description A demo to see if it was possible to manipulate pixelator screens with a script.  This was a quick first stab at it.
// @include     http://www.pixelator.co/*
// @run-at document-start
// @version     1
// @grant       none
// ==/UserScript==

/*--- checkForBadJavascripts()
 This is a utility function, meant to be used inside a Greasemonkey script that
 has the "@run-at document-start" directive set.

 It Checks for and deletes or replaces specific <script> tags.
 */
function checkForBadJavascripts(controlArray) {
	/*--- Note that this is a self-initializing function. The controlArray
	 parameter is only active for the FIRST call. After that, it is an
	 event listener.

	 The control array row is defines like so:
	 [bSearchSrcAttr, identifyingRegex, callbackFunction]
	 Where:
	 bSearchSrcAttr True to search the SRC attribute of a script tag
	 false to search the TEXT content of a script tag.
	 identifyingRegex A valid regular expression that should be unique
	 to that particular script tag.
	 callbackFunction An optional function to execute when the script is
	 found. Use null if not needed.

	 Usage example:
	 checkForBadJavascripts ( [
	 [false, /old, evil init()/, function () {addJS_Node (init);} ],
	 [true, /evilExternalJS/i, null ]
	 ] );
	 */
	if (!controlArray.length)
		return null;

	checkForBadJavascripts = function(zEvent) {
		for (var J = controlArray.length - 1; J >= 0; --J) {
			var bSearchSrcAttr = controlArray[J][0];
			var identifyingRegex = controlArray[J][1];

			if (bSearchSrcAttr) {
				if (identifyingRegex.test(zEvent.target.src)) {
					stopBadJavascript(J);
					return false;
				}
			} else {
				if (identifyingRegex.test(zEvent.target.textContent)) {
					stopBadJavascript(J);
					return false;
				}
			}
		}

		function stopBadJavascript(controlIndex) {
			zEvent.stopPropagation();
			zEvent.preventDefault();

			var callbackFunction = controlArray[J][2];
			if ( typeof callbackFunction == "function")
				callbackFunction(zEvent.target);

			//--- Remove the node just to clear clutter from Firebug inspection.
			//zEvent.target.parentNode.removeChild (zEvent.target);

			//--- Script is intercepted, remove it from the list.
			controlArray.splice(J, 1);
			if (!controlArray.length) {
				//--- All done, remove the listener.
				window.removeEventListener('beforescriptexecute', checkForBadJavascripts, true);
			}
		}

	}
	/*--- Use the "beforescriptexecute" event to monitor scipts as they are loaded.
	 See https://developer.mozilla.org/en/DOM/element.onbeforescriptexecute
	 Note seems to work on acripts that are dynamically created, despite what
	 the spec says.
	 */
	window.addEventListener('beforescriptexecute', checkForBadJavascripts, true);

	return checkForBadJavascripts;
}

/*
 runMeInstead is the script that will be replacing the core pixelator.js file.  It includes the contents of the pixelator.js
 along with our own modifictions.
 */
runMeInstead = function() {

	$.fn.pixelator = function(sendSocket, receiveSocket, sendInterval) {
		var drawing = false, toSend = [], id = Math.floor(Math.random() * 1000000), $canvas = this, canvas = $canvas[0], ctx = canvas.getContext('2d'), pixels = JSON.parse(PIXELS), color = '#000000', pixelSize = 10;
		ctx.width = canvas.width = WIDTH * pixelSize;
		ctx.height = canvas.height = HEIGHT * pixelSize;
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		this.setColor = function(newColor) {
			color = newColor;
		};
		function colorPixel(x, y, color) {
			ctx.fillStyle = color;
			ctx.fillRect(x * 10, y * 10, 10, 10);
		}

		function mapX(x) {
			return Math.floor((x - $canvas.offset().left) / pixelSize);
		}

		function mapY(y) {
			return Math.floor((y - $canvas.offset().top) / pixelSize);
		}


		$.each(pixels, function(x, yRow) {
			$.each(yRow, function(y, col) {
				colorPixel(x, y, col);
			});
		});
		function defer(list, timeout) {
			if (!list.length)
				return;
			var item = list.shift();
			colorPixel(item.x, item.y, item.color);
			setTimeout(function() {
				defer(list, timeout);
			}, timeout);
		}


		receiveSocket.onmessage = function(message) {
			var data = JSON.parse(message.data);
			if (data.id === id)
				return;
			defer(data.pixels, sendInterval / data.pixels.length);
		};
		function drawFromEvent(e) {
			var x = mapX(e.pageX), y = mapY(e.pageY);
			if ($.isNumeric(x) && $.isNumeric(y)) {
				colorPixel(x, y, color);
				console.log(color)
				toSend.push({
					x : x,
					y : y,
					color : color
				});
			}
		}

		// Only draw when the mouse is down.
		$('body').bind('mousedown touchstart', function(e) {
			drawing = true;
			drawFromEvent(e);
		}).bind('mouseup touchend touchcancel', function() {
			drawing = false;
		});
		$canvas.bind('mousemove touchmove', function(e) {
			if (!drawing)
				return;
			e && e.preventDefault();
			if (e.originalEvent.targetTouches)
				e = e.originalEvent.targetTouches[0];
			console.log('drawing')
			drawFromEvent(e);
		});
		// Send our data at regular intervals.
		setInterval(function() {
			if (toSend.length && sendSocket.readyState === 1) {
				sendSocket.send(JSON.stringify({
					id : id,
					pixels : toSend
				}));
				toSend = [];
			}
		}, sendInterval);

		var $messaging = $('#messaging');
		
		/**
		 * passing in the pixel array and the color, this function will iterate over each pixel and color it
		 * also loading up their toSend array which writes over a websocket connection.
		 * 
		 * The time variable is used to throttle the rendering because when run too quickly the websocket connection
		 * can't keep up with the volume of data.
		 */
		var basicDrawingFunction = function(pixelAry, color){
			var time = 100;
			$.each(pixelAry, function(x, yRow) {
				$.each(yRow, function(y, col) {
					(function(x, y, time) {
						setTimeout(function() {
							$messaging.html('Coloring (X:' + x + ', Y:' + y + ')');
							colorPixel(x, y, color);
							toSend.push({
								x : x,
								y : y,
								color : color
							});
						}, time);
					})(x, y, time += 50);
				});
			});
		}

		$('#clearCanvas').bind('click', function(e) {
			basicDrawingFunction(pixels, '#ffffff');
		});

		$('#swapColor').bind('click', function(e) {
			basicDrawingFunction(pixels, '#9fc6e7');
		});

		$('#sayHello').bind('click', function(e) {
			/*Hello pixels were determined by first drawing the picture on a blank canvas
			 Then reloading the canvas and inspecting the 'pixels' variable (which will display in the source)*/
			var hello = JSON.parse('{"6":{"18":"#000000","19":"#000000","20":"#000000","21":"#000000"},"7":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000","31":"#000000"},"8":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000","31":"#000000"},"9":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000","31":"#000000"},"10":{"20":"#000000"},"11":{"20":"#000000"},"12":{"20":"#000000"},"13":{"20":"#000000"},"14":{"20":"#000000"},"15":{"20":"#000000"},"16":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000"},"17":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000"},"18":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000"},"19":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000","29":"#000000","30":"#000000"},"23":{"12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000"},"24":{"27":"#000000","28":"#000000","19":"#000000","12":"#000000","20":"#000000"},"25":{"19":"#000000","28":"#000000","27":"#000000","20":"#000000","12":"#000000"},"26":{"27":"#000000","28":"#000000","19":"#000000","12":"#000000","20":"#000000"},"27":{"19":"#000000","20":"#000000","27":"#000000","28":"#000000","12":"#000000"},"28":{"27":"#000000","28":"#000000","19":"#000000","12":"#000000","20":"#000000"},"29":{"19":"#000000","28":"#000000","27":"#000000","20":"#000000","12":"#000000"},"30":{"27":"#000000","20":"#000000","19":"#000000","12":"#000000","28":"#000000"},"31":{"12":"#000000"},"33":{"27":"#000000","28":"#000000"},"34":{"12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000"},"35":{"12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000"},"36":{"12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000","27":"#000000","28":"#000000"},"37":{"27":"#000000","28":"#000000"},"38":{"27":"#000000","28":"#000000"},"39":{"27":"#000000","28":"#000000"},"40":{"27":"#000000","28":"#000000"},"41":{"27":"#000000","28":"#000000"},"47":{"11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000","24":"#000000","25":"#000000","26":"#000000"},"48":{"26":"#000000"},"49":{"26":"#000000"},"50":{"26":"#000000"},"51":{"26":"#000000"},"52":{"26":"#000000"},"53":{"26":"#000000"},"54":{"26":"#000000"},"55":{"26":"#000000"},"61":{"16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000","23":"#000000"},"62":{"12":"#000000","13":"#000000","14":"#000000","15":"#000000","23":"#000000","24":"#000000"},"63":{"25":"#000000","11":"#000000","12":"#000000"},"64":{"25":"#000000","10":"#000000","26":"#000000"},"65":{"10":"#000000","26":"#000000"},"66":{"26":"#000000","10":"#000000"},"67":{"26":"#000000","11":"#000000","10":"#000000"},"68":{"25":"#000000","11":"#000000","12":"#000000"},"69":{"25":"#000000","12":"#000000","13":"#000000"},"70":{"24":"#000000","25":"#000000","13":"#000000","14":"#000000","15":"#000000"},"71":{"16":"#000000","17":"#000000","23":"#000000","22":"#000000","15":"#000000"},"72":{"17":"#000000","18":"#000000","19":"#000000","20":"#000000","21":"#000000","22":"#000000"},"76":{"25":"#000000","26":"#000000"},"77":{"7":"#000000","8":"#000000","9":"#000000","10":"#000000","11":"#000000","12":"#000000","13":"#000000","14":"#000000","15":"#000000","16":"#000000","17":"#000000","18":"#000000","19":"#000000","20":"#000000","25":"#000000","26":"#000000"},"110":{"43":"#000000"},"112":{"38":"#000000"}}');

			basicDrawingFunction(hello, '#16a765');
		});

	};
	//end pixelator

}//end runMeInstead

/*Using the "checkForBadJavascripts" script I found online to search for the main pixelator.js file on their page during the @run-at document-start section of the GM script
 and replace it with my own version (which is a copy of their's along with my own modifications).*/
checkForBadJavascripts([[true, /pixelator\.js/i,
function() {

	$('body').prepend('<div style="position:absolute; left:945px; top:130px;">Job Status: <div id="messaging"></div></div>');
	$('body').prepend('<div id="clearCanvas" style="position:absolute; left:945px; top:200px;cursor:pointer;">Clear Canvas -- (refresh page prior to running for new content)</div>');
	$('body').prepend('<div id="swapColor" style="position:absolute; left:945px; top:230px;cursor:pointer;">Swap Color To Blue -- (refresh page prior to running for new content)</div>');
	$('body').prepend('<div id="sayHello" style="position:absolute; left:945px; top:260px;cursor:pointer;">Write Hello</div>');

	runMeInstead();
	$('.overlay').hide();

}]]);

