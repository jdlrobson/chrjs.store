clean:
	rm -R test/lib

qunit:
	mkdir -p test/lib
	curl -o test/lib/qunit.js \
		https://github.com/jquery/qunit/raw/master/qunit/qunit.js
	curl -o test/lib/qunit.css \
		https://github.com/jquery/qunit/raw/master/qunit/qunit.css
	curl -o test/lib/jquery.js \
		http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.js
	curl -o test/lib/jquery-json.js \
		http://jquery-json.googlecode.com/files/jquery.json-2.2.js
	curl -o test/lib/chrjs.js \
		https://github.com/tiddlyweb/chrjs/raw/master/main.js

test: qunit
	open test/index.html
