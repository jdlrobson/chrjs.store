(function(module, $) {

module("chrjs.store", {
	setup: function() {
	},
	teardown: function() {
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

})(QUnit.module, jQuery);
