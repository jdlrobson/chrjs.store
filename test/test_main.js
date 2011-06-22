module('chrjs.store', {
	setup: function() {
		ts = tiddlyweb.Store(null, false); // don't load from localStorage
		var t = new tiddlyweb.Tiddler('foo');
		t.text = 'foo bar';
		t.tags = ['foo', 'bar'];
		t.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.add(t);
		var s = new tiddlyweb.Tiddler('HelloThere');
		s.text = 'Hello World, from the Test Suite';
		s.tags = ['tag1', 'tag2'];
		s.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.add(s);
		window.localStorage = undefined;
	},
	teardown: function() {
		ts = undefined;
	}
});

test('remove tiddler', function() {
	var tiddlers = ts();
	strictEqual(tiddlers.length, 2, "There should be 2 tiddlers in the store")
	ts.remove('foo');
	tiddlers = ts();
	strictEqual(tiddlers.length, 1, "when foo is removed there should only be one.");
	strictEqual(tiddlers[0].title, "HelloThere", "make sure HelloThere is the remaining tiddler");
});

test('Count Tiddlers', function() {
	var count = 0;
	ts.each(function(tiddler) {
		count++;
	});
	strictEqual(count, 2);
});

test('Add Tiddlers', function() {
	var tid = new tiddlyweb.Tiddler('Bar');
	tid.text = 'A New Tiddler';
	var addedTid = ts.add(tid).get('Bar');
	strictEqual(addedTid.title, 'Bar');
	strictEqual(addedTid.text, 'A New Tiddler');
	equal(addedTid.lastSync, undefined);
	strictEqual(addedTid.bag.name, 'foo_public');
});

test('Save Tiddlers', function() {
	var count = 0;
	ts.each(function(tiddler) {
		equal(tiddler.lastSync, undefined);
		count++;
	});
	ts.save(function(tiddler) {
		notEqual(tiddler.lastSync, undefined);
		count--;
	});
	strictEqual(count, 0);
});

test('Retrieve tiddler (from cache)', function() {
	ts.get('HelloThere', function(tiddler) {
		strictEqual(tiddler.text, 'Hello World, from the Test Suite', 'test correct text is on tiddler');
	});
});

test('Retrieve tiddler (from server)', function() {
	// this tiddler is not in the local store
	var tid = new tiddlyweb.Tiddler("TidOnServer");
	tid.bag = new tiddlyweb.Bag("foo", "/")
	ts.get(tid, function(tiddler) {
		strictEqual(tiddler.title, 'TidOnServer', 'check a tiddler object has been found with correct title');
		strictEqual(tiddler.text, 'Hello World', 'check the text was found as it was on the "server"');
	});
});

test('Delete tiddler local', function() {
	var tid = new tiddlyweb.Tiddler("HelloThere");
	tid.bag = new tiddlyweb.Bag('foo_public', '/');
	ts.remove({ tiddler: tid, pending: true }, function(tid) {
		strictEqual(localStorage.getItem('foo_public/HelloThere'), null,
			'there should nothing in local storage after I have explicitly asked to delete anything pending');
	});
});

test('Delete tiddler server', function() {
	var tid = new tiddlyweb.Tiddler("HelloThere");
	tid.bag = new tiddlyweb.Bag('foo_public', '/');
	ts.remove({ tiddler: tid, delete: true }, function(tiddler) {
		strictEqual(tiddler.title, 'HelloThere', 'The tiddler HelloThere was deleted from server');
	});
});

test('Delete tiddler that is local but not on server', function() {
	var tid = new tiddlyweb.Tiddler('foo');
	tid.bag = new tiddlyweb.Bag('foo_public', '/');
	ts.remove({ tiddler: tid, delete: true }, function(tiddler) {
		strictEqual(tiddler, null, "The tiddler foo only exists in local storage");
		strictEqual(localStorage.getItem('foo_public/foo'), null,
			'make sure the tiddler was removed from local storage');
		// TODO: I should also be able to detect in the callback that the deletion on the server failed but didn't locally.
	});
});
