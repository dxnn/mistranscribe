(function($){  
  var methods = {
    // initialize our datastore... for better or worse
    init: function() {
      // we set up a global repository for transformers so we can hit them all with one setInterval loop
      // THINK: there's probably a cleaner way of doing this...
      if(typeof(MSTRNSCRB) == 'undefined') {
        MSTRNSCRB = {};
        MSTRNSCRB.transformers = {};
        MSTRNSCRB.extensions = [];
        MSTRNSCRB.settings = {
          'basetime': 250,
          'startchars': '{\\(',
          'endchars': '\\)}',
          'splitchars': '\\|'
        };
      }
    },
    
    // the parse method builds our spans
    parse: function(options) {
      methods.init();
      
      // THINK: this settings thing is pretty silly, but it keeps things consistent across methods. find a better way.
      var settings = MSTRNSCRB.settings;
      if(options) {
        $.extend(settings, options);
      }
    
      this.each(function() {
        var html = $(this).html();
        var newhtml = '';
        var chunks;
        var counter = 0;
        var lastIndex = 0;
      
        regex = new RegExp('([\\s\\S]*?)(' + settings.startchars + '[\\s\\S]+?' + settings.endchars + ')', 'g'); 
        RegExp.lastIndex = 0;
      
        // find each parsable chunk
        while((chunks = regex.exec(html)) != null) {
          newhtml += chunks[1]; // put the regular stuff back in place
          var segments = chunks[2].substring(2,chunks[2].length - 2).split(new RegExp(settings.splitchars)); // split fancy stuff on pipes
          var items = [];
          var transformer = {};
          
          // if there's an empty segment after the first one, and more segments after that, that first one is a preamble
          // ex. {(name:neato,linear,once||so|soo|sooo|soooo)}
          if(segments.length > 2 && segments[0] && !segments[1]) {
            var preamble = {};
            splitsextends(preamble, segments[0]);
            for (var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--){
              MSTRNSCRB.extensions[i].preambler(preamble, transformer);
            };
            segments = segments.slice(2);
          }

          // examine each remaining segment in turn
          for (var index=0; index < segments.length; index++) {
            // assemble the item
            if(segments[index].indexOf('::') != -1) {
              var parts = segments[index].split(/::/);
              items[index] = {value: parts[0]};
              splitsextends(items[index], parts[1]);
            } else {
              items[index] = {value: segments[index]};
            }
            
            // allow each extension in turn to parse each segment
            for(var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--) {
              items[index] = MSTRNSCRB.extensions[i].parser(items[index], transformer);
            };
          };

          // set up the span
          var id = 'mstrnscrb-' + ++counter;
          var span = '<span class="mstrnscrb" id="' + id + '">' + items[0].value + '</span>'; 
          newhtml += span;

          transformer.items = items;
          MSTRNSCRB.transformers[id] = transformer;
          lastIndex = regex.lastIndex;
        }

        newhtml += html.substring(lastIndex); // tack on the end
        $(this).html(newhtml);
      });

      // start the callback if needed
      // THINK: it might be better to do this once for each element, so we can shut them off individually...
      if(!MSTRNSCRB.setIntervalId) {
        methods.start(options);
      }

      return this;
    },
    
    // the start method sets the timer
    start: function(options) {
      var settings = MSTRNSCRB.settings;
      if(options) {
        $.extend(settings, options);
      }
      
      MSTRNSCRB.setIntervalId = setInterval(function() {
        $.each(MSTRNSCRB.transformers, function(index, transformer) {          
          var pickitem;
          for(var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--) {
            if(pickitem = MSTRNSCRB.extensions[i].picker(transformer.items, transformer)) {i = -1;} // stop at the first match
          };
          
          MSTRNSCRB.transformers[index].current = pickitem;
          $('#' + index).html(pickitem.value);
        });
      }, settings.basetime);
    },
    
    // the stop method freezes time
    stop: function() {
      clearInterval(MSTRNSCRB.setIntervalId);
    },
    
    // extend adds a new preambler/parser/picker to the mistranscriber
    extend: function(object) {
      if(!object || !object.keyword || !object.preambler || !object.parser || !object.picker) {
        $.error('That is not a valid mistranscribe extension');
      }
      
      methods.init();
      MSTRNSCRB.extensions.push(object);
    },
    
    // remove an extension
    unextend: function(keyword) {
      MSTRNSCRB.extensions = _.reject(MSTRNSCRB.extensions, function(extension){ return extension.keyword == keyword; });
    }
  }
  
  
  // main plugin
  $.fn.mistranscribe = function(method) {
    if (methods[method]) {
      return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.parse.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jQuery.mistranscribe' );
    }    
  };
  
  
  // add the basic functionality
  $.fn.mistranscribe('extend', {
    keyword: 'basic',
    preambler: function(preamble, transformer) {
      return false; // do nothing
    },
    parser: function(item, transformer) {
      return item; // send it back as-is
    },
    picker: function(items, transformer) {
      return items[Math.round(Math.random() * (items.length - 1))]; // pick a random item
    }
  });
  
  
  // Add some extra extensions for flavor and awesome
  // A note about extensions: they run in reverse of the order they are added, which can cause some spectacular conflicts. Be wary of anyone hawking magical extension-conflict-resolving extensions: they never actually work, and typically just end up conflicting with each other. 
  
  
  // show segments in varying ratios
  $.fn.mistranscribe('extend', {
    keyword: 'ratio',
    preambler: function(preamble, transformer) {
      return false; // do nothing
    },
    parser: function(item, transformer) {
      if(item.ratio) {
        item.ratio = parseInt(item.ratio);
      } else {
        item.ratio = 1;
      }
      return item;
    },
    picker: function(items, transformer) {
      var total = _.reduce(items, function(memo, item){ return memo + item.ratio; }, 0);
      var pick = Math.random() * total;
      var last = 0;
      var pickitem;
      $.each(items, function(i, item) {
        if(pick < (item.ratio + last)) {pickitem = item; return false;}
        last += item.ratio;
      });
      
      return pickitem;
    }
  });
  
  
  // keep: show segments for varying durations
  $.fn.mistranscribe('extend', {
    keyword: 'keep',
    preambler: function(preamble, transformer) {
      return false; // do nothing
    },
    parser: function(item, transformer) {
      if(item.keep) {
        item.keep = parseInt(item.keep);
      }
      return item;
    },
    picker: function(items, transformer) {
      if(_.isNull(transformer.keep_count)) {
        return false;
      }
      
      // first pass
      if(_.isUndefined(transformer.keep_count)) {
        for (var i = items.length - 1; i >= 0; i--){
          if(items[i].keep) {
            transformer.keep_count = 0;
          }
        };
        if(transformer.keep_count !== 0) {
          transformer.keep_count = null;
        }
        return false;
      }
      
      // value selected
      if(transformer.keep_count === 0) {
        if(transformer.keep_toggle) {
          transformer.keep_toggle = false;
          return false;
        }
        
        if(!transformer.current.keep) {
          return false;
        }
        
        transformer.keep_count = transformer.current.keep;
      }
      
      // return customer
      if(transformer.keep_count) {
        --transformer.keep_count;
        if(!transformer.keep_count) {
          transformer.keep_toggle = true;
        }
        return transformer.current;
      }
    }
  });
  
  
  // linear: show segments linearly, one after the other
  $.fn.mistranscribe('extend', {
    keyword: 'linear',
    preambler: function(preamble, transformer) {
      if(preamble.linear) {
        transformer.linear = true;
        transformer.linear_count = -1;
      }
    },
    parser: function(item, transformer) {
      return item;
    },
    picker: function(items, transformer) {
      if(transformer.linear) {
        transformer.linear_count = (transformer.linear_count + 1) % items.length;
        return items[transformer.linear_count];
      }
    }
  });
  
  
  // times: only run N * items.length times
  $.fn.mistranscribe('extend', {
    keyword: 'times',
    preambler: function(preamble, transformer) {
      if(preamble.times) {
        transformer.times = preamble.times;
        transformer.times_count = 0;
      }
    },
    parser: function(item, transformer) {
      return item;
    },
    picker: function(items, transformer) {
      if(transformer.times) {
        transformer.times_count++;
        if(transformer.times_count > (transformer.times * items.length)) {
          return transformer.current;
        }
      }
    }
  });
  
  
  // name: set a master and have others follow
  $.fn.mistranscribe('extend', {
    keyword: 'name',
    preambler: function(preamble, transformer) {
      if(preamble.name) {
        transformer.name = preamble.name;
      }
      if(preamble.follow) {
        transformer.follow = preamble.follow;
      }
      if(preamble.copy) {
        transformer.copy = preamble.copy;
      }
    },
    parser: function(item, transformer) {
      return item;
    },
    picker: function(items, transformer) {
      var return_item;
      
      if(transformer.copy) {
        $.each(MSTRNSCRB.transformers, function(index, test_trans) {          
          if(test_trans.name == transformer.copy) {
            return_item = test_trans.current;
            return false;
          }
        });
      }
      
      if(transformer.follow) {
        $.each(MSTRNSCRB.transformers, function(index, test_trans) {          
          if(test_trans.name == transformer.follow) {
            for (var j = test_trans.items.length - 1; j >= 0; j--){
              if(test_trans.items[j].value == test_trans.current.value) {
                return_item = items[j] || test_trans.current;
                return false;
              }
            };
          }
        });
      }
      
      return return_item;
    }
  });

  
  // morph: transform from one thing into another
  $.fn.mistranscribe('extend', {
    keyword: 'morph',
    preambler: function(preamble, transformer) {
      if(preamble.morph) {
        transformer.morph = preamble.morph;
      }
    },
    parser: function(item, transformer) {
      return item;
    },
    picker: function(items, transformer) {
      if(transformer.morph) {
        if(!transformer.prev) { // pick the first item
          transformer.prev = items[0];
          transformer.morph_count = 0;
          transformer.current = items[0]; // THINK: bit of a hack...
        }
        if(!transformer.next) { // pick a new item
          // THINK: there might be a way to let some other extension handle this, so you could pair morph w/ linear or whatever. but for now, we'll just pick the next one linearly.
          transformer.morph_count = (transformer.morph_count + 1) % items.length;
          transformer.next = items[transformer.morph_count];
        }
        
        // compare strings
        var current_string = transformer.current.value;
        var target_string = transformer.next.value;
        var index = target_string.indexOf(current_string);
        
        if(index == -1) { 
          // no c->t match, check for t->c
          var reverse_index = current_string.indexOf(target_string);
          if(reverse_index < 1) {
            // no match at all or match at beginning, remove a char from the end
            current_string = current_string.slice(0, -1);
          } else { 
            // match at the end or middle, remove a char from beginning
            current_string = current_string.slice(1);
          }
        } else if(index == 0) { 
          // match at beginning, add a char to the end
          current_string = target_string.slice(0, current_string.length+1);
        } else if(index == target_string.length - current_string.length) { 
          // match at the end, add a char to beginning
          current_string = target_string.slice(-1 * (current_string.length + 1));
        } else { 
          // match somewhere, do something
          current_string = target_string.slice(index-1, current_string.length + index);
        }
        
        // are they the same now?
        if(current_string == target_string) {
          transformer.prev = transformer.next;
          delete(transformer.next);
        }
        
        return {value: current_string};
      }
    }
  });
  
  
  
  
  // helper function for spliting key:value and embedding
  var splitsextends = function(object, string) {
    var strings = string.split(/,/);
    
    for (var i=0; i < strings.length; i++) {
      if(strings[i].indexOf(':') != -1) {
        var key_value = strings[i].split(/:/);
        var key = key_value[0].replace(/^\s+|\s+$/g, "");
        var value = key_value[1].replace(/^\s+|\s+$/g, "");
        object[key] = value;
      } else {
        var key = strings[i].replace(/^\s+|\s+$/g, "");
        object[key] = true;
      }
    };
  }
  
  // TODOs: degrade nicely, non-globalize, different setInterval loops etc for different invocations, more extensions, README, updatable textarea, examples, base 
  
})(jQuery);