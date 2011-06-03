(function(module, $) {

var testStore;
module("chrjs.store", {
	setup: function() {
		testStore = new tiddlyweb.Store();
		testStore.addTiddler({ title: "abc", tags: [] });
		testStore.addTiddler({ title: "def", tags: [] });
		testStore.addTiddler({ title: "ghi", tags: ["foo"] });
		testStore.addTiddler({ title: "jkl", tags: ["foo"] });
	},
	teardown: function() {
		testStore = null;
	}
});

test("getTiddler / addTiddler (tiddler object)", function() {
	var store = new tiddlyweb.Store();
	var test = store.getTiddler("test");
	var tiddler = new tiddlyweb.Tiddler("test");
	store.addTiddler(tiddler);
	var test2 = store.getTiddler("test");

	strictEqual(test, null, "no tiddler called test initially in store");
	strictEqual(test2.title, "test", "check the returned tiddler has title test");
});

test("getTiddler / addTiddler (json)", function() {
	var store = new tiddlyweb.Store();
	var test = store.getTiddler("test");
	store.addTiddler({ title: "test", fields: { foo: "bar" } });
	var test2 = store.getTiddler("test");

	strictEqual(test, null, "no tiddler called test initially in store");
	strictEqual(test2.title, "test", "check the returned tiddler has title test");
	strictEqual(test2.fields.foo, "bar", "the field was set on the new tiddler");
});

test("each", function() {
	var test = [];
	var tiddlers = testStore.each(function(tiddler) {
		if(tiddler.tags.indexOf("foo") > -1) {
			test.push(tiddler);
		}
	});
	strictEqual(tiddlers.length, 2, "only 2 tiddlers are tagged foo");
});

})(QUnit.module, jQuery);
