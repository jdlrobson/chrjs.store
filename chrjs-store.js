/*
 * A store object, using the chrjs library.
 *
 * mechanisms to interact with tiddlers, bags, recipes, etc on TiddlySpace
 * and mechanisms to refresh those things and keep them up to date in the
 * browser.
 *
 * Dependencies: chrjs, jQuery
 *
 * Written by Ben Gillies
 */

/*global tiddlyweb, window, jQuery*/

(function($) {

// the Tiddlers object is a list of tiddlers that you can operate on/filter. Get a list by calling the Store instance as a function (with optional filter)
var Tiddlers = function(store) {
	this.store = store;
	return this;
};

Tiddlers.prototype = [];

// private functions
var contains = function(field, match) {
	return (field && field.indexOf(match) !== -1) ? true : false;
};

// public functions
$.extend(Tiddlers.prototype, {
	tag: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.tags, match);
		});
	},
	text: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.text, match);
		});
	},
	title: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.title, match);
		});
	},
	attr: function(name, match) {
		var chkExists = (!match) ? true : false,
			getValue = function(tiddler) {
				return tiddler[name] || (tiddler.fields && tiddler.fields[name]);
			};
		return this.map(function(tiddler) {
			if (chkExists) {
				return (getValue(tiddler)) ? true : false;
			} else {
				return contains(getValue(tiddler), match);
			}
		});
	},
	bag: function(name) {
		return this.map(function(tiddler) {
			var bag = tiddler.bag && tiddler.bag.name;
			return (bag === name);
		});
	},
	// the space the tiddler originates from (i.e. not just included in)
	space: function(name) {
		var regex = /(_public|_private|_archive)$/;
		return this.map(function(tiddler) {
			var bag = tiddler.bag && tiddler.bag.name;
			return (bag.replace(regex, '') === name);
		});
	},
	// no arguments matches the default recipe
	recipe: function(name) {
		var matchCurrent = (name === undefined) ? true : false, recipe;
		if (matchCurrent) {
			recipe = this.store.recipe.name;
		}
		return this.map(function(tiddler) {
			if (!matchCurrent) {
				recipe = tiddler.recipe && tiddler.recipe.name;
			}
			return (recipe === name);
		});
	},
	// tiddlers that have been changed (i.e. not synced), lastSynced is optional and if present matches tiddlers that were synced before lastSynced
	dirty: function(lastSynced) {
		if (!lastSynced) {
			return this.map(function(tiddler) {
				return (tiddler.lastSync) ? false : true;
			});
		} else {
			return this.map(function(tiddler) {
				if (tiddler.lastSync) {
					// return true if tiddler.lastSync is older than lastSynced
					return (+tiddler.lastSync < +lastSynced);
				} else {
					return true;
				}
			});
		}
	},
	each: function(fn) {
		var self = this;
		$.each(self, function(i, tiddler) {
			fn.apply(self, [tiddler, i]);
		});
		return self;
	},
	// returns a new instance of Tiddlers
	map: function(fn) {
		var self = this,
			result = new Tiddlers(this.store);
		$.each(self, function(i, tiddler) {
			if (fn.apply(self, [tiddler, i])) {
				result.push(tiddler);
			}
		});
		return result;
	},
	// pass in an initial value and a callback. Callback gets tiddler and current result, and returns new result
	reduce: function(init, fn) {
		var self = this, result = init;
		$.each(self, function(i, tiddler) {
			result = fn.apply(self, [tiddler, result]);
		});
		return result;
	},
	// bind fn to the current set of matched tiddlers. fn will run any time a tiddler that matches the current filters is updated
	bind: function(fn) {
		var self = this, filters = function() {};// get filters currently applied
		this.store.bind('tiddler', function(tiddler) {
			if (filters([tiddler])) {
				fn.apply(self, [tiddler]);
			}
		});
	},
	// save tiddlers currently in list. Callback happens for each tiddler
	save: function(callback) {
		var self = this;
		$.each(self, function(i, tiddler) {
			self.store.saveTiddler(tiddler, callback);
		});
		return self;
	},
	// add one or more tiddlers to the current Tiddlers object and the attached store
	add: function(tiddlers) {
		var self = this;
		if (tiddlers instanceof tiddlyweb.Tiddler) {
			self.push(tiddlers);
			self.store.addTiddler(tiddlers);
		} else {
			$.each(tiddlers, function(i, tiddler) {
				self.push(tiddler);
				self.store.addTiddler(tiddlers);
			});
		}
		return self;
	}
});

tiddlyweb.Store = function() {
	// take in an optional filter and return a Tiddlers object with the tiddlers that match it
	var self,
		// private
		space = {
			name: '',
			type: 'private' // private or public (aka r/w or read only)
		},
		binds = {
			recipe: { all: [] },
			bag: { all: [] },
			tiddler: { all: [] }
		},
		// construct an ID for use in localStorage
		getStorageID = function(tiddler) {
			return encodeURIComponent(tiddler.bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		},
		// format bags or tiddlers suitable for storing
		resource = function(thing, isLocal) {
			var obj;
			if (thing instanceof tiddlyweb.Bag) {
				obj = {
					thing: thing, // bag object
					tiddlers: {}
				};
			} else {
				thing.lastSync = (!isLocal) ? new Date() : null;
				obj = thing;
			}

			return obj;
		},
		replace, store = {};
	// add/replace the thing in the store object with the thing passed in.
	// different to addTiddler, which only adds to pending
	replace = function(thing) {
		if (thing instanceof tiddlyweb.Bag) {
			if (store[thing.name]) {
				store[thing.name].thing = thing;
			} else {
				store[thing.name] = resource(thing);
			}
			self.trigger('bag', null, thing);
			self.trigger('bag', thing.name, thing);
			return true;
		} else {
			// add the tiddler to the appropriate place in the store. If it comes with a new bag, add that as well
			var bagName = thing.bag.name,
				oldBag = (!store[bagName]) ? !replace(new tiddlyweb.Bag(bagName,
					'/')) : store[bagName],
				oldRevision = (!oldBag ||
					!oldBag.tiddlers[thing.title]) ? null :
					oldBag.tiddlers[thing.title].revision;
			store[bagName].tiddlers[thing.title] = resource(thing);
			if (thing.revision !== oldRevision) {
				self.trigger('tiddler', null, thing);
				self.trigger('tiddler', thing.title, thing);
			}
			return true;
		}
	};

	// public variables
	self = function(name, match) {
		var allTiddlers = new Tiddlers(this);

		self.each(function(tiddler, title) {
			allTiddlers.push(tiddler);
		});

		if (allTiddlers[name]) {
			allTiddlers = allTiddlers[name](match);
		} else if (name) {
			allTiddlers = allTiddlers.attr(name, match);
		}

		return allTiddlers;
	};
	self.recipe = null;
	self.pending = {};

	// public functions

	// takes in a  callback. calls callback with space object containing name and type or error
	self.getSpace = function(callback) {
		if (space.name !== '') {
			callback(space);
		} else {
			$.ajax({
				url: '/?limit=1', // get a tiddler from whatever is default
				dataType: 'json',
				success: function(data) {
					var recipeName = ((data instanceof Array) ? data[0].recipe :
							data.recipe) || 'No Recipe Found',
						match = recipeName.match(/^(.*)_(private|public)$/);
					if (match) {
						space.name = match[1];
						space.type = match[2];
						self.recipe = new tiddlyweb.Recipe(recipeName, '/');
						callback(space);
					} else {
						callback(null, {
							name: 'NoSpaceMatchError',
							message: data.recipe + ' is not a valid space'
						});
					}
				},
				error: function(xhr, txtStatus, err) {
					callback(null, err);
				}
			});
		}

		return self;
	};

	// takes thing to bind to (e.g. 'tiddler'), optional name (e.g. tiddler title), and callback that fires whenever object updates.
	// if name not present, then callbck fires whenever any object of that type updates.
	self.bind = function(type, name, callback) {
		if (binds[type]) {
			if (name) {
				if (!binds[type][name + type]) {
					binds[type][name + type] = [];
				}
				binds[type][name + type].push(callback);
			} else {
				binds[type].all.push(callback);
			}
		}

		return self;
	};

	// same input as bind, though name and callback both optional. If callback present, any function the same (i.e. ===) as callback
	// will be removed.
	self.unbind = function(type, name, callback) {
		var stripCallback = function(list) {
			if (callback) {
				$.each(list, function(i, func) {
					if (callback === func) {
						list.splice(i, 1);
					}
				});
				return list;
			} else {
				return [];
			}
		};
		if ((binds[type]) && (name)) {
				binds[type][name + type] =
					stripCallback(binds[type][name + type]);
		} else {
			binds[type].all = stripCallback(binds[type].all);
		}

		return self;
	};

	// fire an event manually. message is the object that gets passed into the event handlers
	self.trigger = function(type, name, message) {
		if (binds[type]) {
			$.each(binds[type].all, function(i, func) {
				func(message);
			});
			if (name && binds[type][name + type]) {
				$.each(binds[type][name + type], function(i, func) {
					func(message);
				});
			}
		}

		return self;
	};

	// refresh the main recipe (i.e. the one currently being used).
	self.refreshRecipe = function() {
		if (self.recipe) {
			self.recipe.get(function(newRecipe) {
				self.recipe = newRecipe;
				$.each(self.recipe.recipe, function(i, bag) {
					store[bag[0]] = resource(new tiddlyweb.Bag(bag[0], '/'));
				});
				self.trigger('recipe', null, self.recipe);
			}, function(xhr, err, errMsg) {
				// ignore
			});
		} else {
			self.getSpace(function() {
				if (self.recipe) {
					self.refreshRecipe();
				}
			});
		}

		return self;
	};

	// refresh the bags contained in the recipe. it is likely that some will return 403. This is expected
	self.refreshBags = function() {
		var recipeComplete;
		recipeComplete = function() {
			if (!$.isEmptyObject(store)) {
				self.refreshBags();
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (!$.isEmptyObject(store)) {
			$.each(store, function(i, oldBag) {
				oldBag.thing.get(function(bag) {
					replace(bag);
				}, function(xhr, err, errMsg) {
					// trigger anyway...
					replace(oldBag.thing);
				});
			});
		} else {
			self.bind('recipe', null, recipeComplete);
			self.refreshRecipe();
		}

		return self;
	};

	// refresh tiddlers contained in the recipe. Optional bag parameter will refresh tiddlers specifically in a bag
	self.refreshTiddlers = function(bag) {
		var getTiddlersSkinny = function(container) {
			var tiddlerCollection = container.tiddlers();
			tiddlerCollection.get(function(result) {
				$.each(result, function(i, tiddler) {
					replace(tiddler);
				});
			}, function(xhr, err, errMsg) {
				throw {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddlers from ' + bag.name +
						': ' + errMsg
				};
			});
		}, recipeComplete;
		recipeComplete = function() {
			if (self.recipe) {
				self.refreshTiddlers();
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (bag && store[bag.name]) {
			getTiddlersSkinny(bag);
		} else if (self.recipe) {
			getTiddlersSkinny(self.recipe);
		} else {
			self.bind('recipe', null, recipeComplete);
			self.refreshRecipe();
		}

		return self;
	};

	// returns the tiddler, either directly if no callback, or fresh from the server inside the callback if given
	// returns pending first, then in recipe order (ie last bag first) if > 1 exist
	self.getTiddler = function(tiddlerName, callback) {
		var pending = self.pending[tiddlerName] || null,
			tiddler = (function() {
				var tiddler = pending;
				if (tiddler) {
					return tiddler;
				}
				self.each(function(tid, title) {
					if (title === tiddlerName) {
						tiddler = tid;
						return false;
					}
				});
				return tiddler;
			}()),
			skinny = (typeof(callback) === 'function') ? false : true;
		if (skinny) {
			return tiddler;
		} else if (pending) {
			callback(pending);
		} else if (tiddler) {
			tiddler.get(function(tid) {
				replace(tid);
				callback(tid);
			}, function(xhr, err, errMsg) {
				callback(null, {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddler: ' + errMsg
				});
			});
		} else {
			callback(null);
		}
		return self;
	};

	// return the bag, as with getTiddler
	self.getBag = function(bagName, callback) {
		var skinny = (typeof callback === 'undefined') ? true : false,
			result = null;
		self.each('bag', function(bag, name) {
			if (name === bagName) {
				result = bag;
				return false;
			}
		});
		if (skinny) {
			return result;
		} else {
			callback(result);
			return self;
		}
	};

	// loops over every thing (tiddler (default) or bag) and calls callback with them
	self.each = function(thing, cllbck) {
		var callback = (typeof thing === 'function') ? thing : cllbck,
			loopTiddlers = (thing === 'bag') ? false : true,
			loopOver = function(list, callback) {
				var finished = true, name;
				for (name in list) {
					if (list.hasOwnProperty(name)) {
						if (callback(list[name], name) === false) {
							finished = false;
							break;
						}
					}
				}
				return finished;
			};
		// loop over pending first
		if (loopTiddlers && !loopOver(self.pending, callback)) {
			return self;
		}
		loopOver(store, function(bag, bagName) {
			if (loopTiddlers) {
				if (!loopOver(store[bagName].tiddlers, callback)) {
					return false;
				}
			} else {
				if (callback(bag.thing, bagName) === false) {
					return false;
				}
			}
		});

		return self;
	};

	// add a tiddler to the store. Adds to pending (and localStorage).  will add whether a tiddler exists or not. Won't save until save
	// if bag is not present, will set bag to <space_name> + _public
	// if tiddler already in store[bag], will remove until saved to server
	self.addTiddler = function(tiddler) {
		var saveLocal = function(tiddler) {
			var localStorageID;
			if (window.hasOwnProperty('localStorage')) {
				localStorageID = getStorageID(tiddler);
				window.localStorage.setItem(localStorageID,
					tiddler.toJSON());
			}
		};
		self.pending[tiddler.title] = resource(tiddler, true);

		if (!tiddler.bag) {
			self.getSpace(function(space) {
				var bagName = space.name + '_public';
				tiddler.bag = self.getBag(bagName);
				saveLocal(tiddler);
				self.trigger('tiddler', null, tiddler);
				self.trigger('tiddler', tiddler.title, tiddler);
			});
		} else {
			saveLocal(tiddler);
			self.trigger('tiddler', null, tiddler);
			self.trigger('tiddler', tiddler.title, tiddler);
		}

		return self;
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending
	self.save = function(callback) {
		var empty = true;
		$.each(self.pending, function(i, tiddler) {
			if (empty) {
				empty = false;
			}
			self.saveTiddler(tiddler, callback);
		});
		if (empty) {
			callback(null, {
				name: 'EmptyError',
				message: 'Nothing to save'
			});
		}

		return self;
	};

	// save a tiddler from pending directly by name, and remove it
	self.saveTiddler = function(tiddler, callback) {
		delete self.pending[tiddler.title]; // delete now so that changes made during save are kept
		tiddler.put(function(response) {
			if (window.hasOwnProperty('localStorage')) {
				window.localStorage.removeItem(getStorageID(tiddler));
			}
			response = resource(response);
			replace(response);
			callback(response);
		}, function(xhr, err, errMsg) {
			if (!self.pending[tiddler.title]) {
				self.pending[tiddler.title] = resource(tiddler, true);
			}
			callback(null, {
				name: 'SaveError',
				message: 'Error saving ' + tiddler.title + ': ' + errMsg
			});
		});

		return self;
	};

	// remove a tiddler, either locally from pending, from the store, or delete from the server.
	// callback is optional. options can be a tiddler object, a string with the title, or an object with the following:
	// tiddler, delete (bool, delete from server), callback, pending (bool, delete pending only)
	// default is don't delete from server, only remove pending
	self.remove = function(options, cllbck) {
		var isTiddler = (options instanceof tiddlyweb.Tiddler),
			tiddler = (typeof options === 'string') ? self.getTiddler(options) :
				(isTiddler) ? options : options.tiddler || null,
			callback = cllbck || options.callback || null,
			del = (!isTiddler && options['delete']) || false,
			pending = (!isTiddler && options.pending) || true,
			removeLocal = function(tiddler, pending, synced) {
				var bagName = tiddler.bag.name;
				if (pending) {
					delete self.pending[tiddler.title];
				}
				if (synced) {
					bagName = tiddler.bag.name;
					delete store[bagName].tiddlers[tiddler.title];
				}
				if (callback) {
					callback(tiddler);
				}
			};

		if (!tiddler) {
			return self;
		}
		if (del) {
			tiddler['delete'](function() {
				removeLocal(tiddler, true, true);
			}, function(xhr, err, errMsg) {
				if (callback) {
					callback(null, {
						name: 'DeleteError',
						message: 'Error deleting ' + tiddler.title + ': '
							+ errMsg
					});
				}
			});
		} else if (pending) {
			removeLocal(tiddler, true, false);
		} else {
			removeLocal(tiddler, false, true);
		}

		return self;
	};

	// import pending from localStorage
	self.retrieveCached = function() {
		if (window.hasOwnProperty('localStorage')) {
			$.each(window.localStorage, function(i) {
				var key = window.localStorage.key(i),
					names = key.split('/'),
					bagName = decodeURIComponent(names[0]),
					name = decodeURIComponent(names[1]),
					tiddlerJSON = $.parseJSON(window.localStorage[key]),
					tiddler = new tiddlyweb.Tiddler(name);
				tiddler.bag = new tiddlyweb.Bag(bagName, '/');
				$.extend(tiddler, tiddlerJSON);
				self.addTiddler(tiddler, true);
			});
		}

		return self;
	};

	return self;
};

}(jQuery));
