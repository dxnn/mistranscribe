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
          'basetime': 500,
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
      
        // TODO: allow alternate start, end, and split characters
            
        regex = new RegExp('([\\s\\S]*?)(' + settings.startchars + '[\\s\\S]+?' + settings.endchars + ')', 'g'); 
        RegExp.lastIndex = 0;
      
        // find each parsable chunk
        while((chunks = regex.exec(html)) != null) {
          newhtml += chunks[1]; // put the regular stuff back in place
          var segments = chunks[2].substring(2,chunks[2].length - 2).split(new RegExp(settings.splitchars)); // split fancy stuff on pipes
          var items = [];
          
          // if there's an empty segment after the first one, and more segments after that, that first one is a preamble
          // ex. {(name:neato,linear,once||so|soo|sooo|soooo)}
          if(segments.length > 2 && segments[0] && !segments[1]) {
            preamble = segments[0].split(/,/); // break on commas
            for (var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--){
              MSTRNSCRB.extensions[i].preambler(preamble);
            };
          }

          // allow each extension in turn to parse each segment
          $.each(segments, function(index, segment) {
            parts = segment.split(/,/); // break on commas
            items[index] = {
              value: parts[0],
              parts: parts
            };
            for(var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--) {
              items[index] = MSTRNSCRB.extensions[i].parser(items[index]);
            };
            // var sections = segment.split(/,/);
            // items[index] = {
            //   value: sections[0],
            //   proportion: (parseInt(sections[1]) || 1),
            //   duration: (parseInt(sections[2]) || 1)
            // }
          });

          // set up the span
          var id = 'mstrnscrb-' + ++counter;
          var span = '<span id="' + id + '">' + items[0].value + '</span>'; 

          newhtml += span;
          MSTRNSCRB.transformers[id] = {items: items};
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
          // var total = _.reduce(items, function(memo, item){ return memo + item.proportion; }, 0);
          // var pick = Math.random() * total;
          // var last = 0;
          // var pickitem;
          // $.each(items, function(i, item) {
          //   if(pick < (item.proportion + last)) {pickitem = item; return false;}
          //   last += item.proportion;
          // });
          // $('#' + index).html(pickitem.value);
          
          var pickitem;
          for(var i = MSTRNSCRB.extensions.length - 1; i >= 0; i--) {
            if(pickitem = MSTRNSCRB.extensions[i].picker(transformer.items)) {i = -1;} // stop at the first match
          };
          
          MSTRNSCRB.transformers[index].current = pickitem.value;
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
    preambler: function(preamble) {
      return false; // do nothing
    },
    parser: function(item) {
      return item; // send it back as-is
    },
    picker: function(items) {
      return items[Math.round(Math.random() * (items.length - 1))]; // pick a random item
    }
  });
  
  
  // Add some extra extensions for flavor and awesome
  // A note about extensions: they run in reverse of the order they are added, which can cause some spectacular conflicts. Be wary of anyone hawking magical extension-conflict-resolving extensions: they never actually work, and typically just end up conflicting with each other. 
  
  $.fn.mistranscribe('extend', {
    keyword: 'ratio',
    preambler: function(preamble) {
      return false; // do nothing
    },
    parser: function(item) {
      return item; // send it back as-is
    },
    picker: function(items) {
      return items[Math.round(Math.random() * (items.length - 1))]; // pick a random item
    }
  });
  
  
})(jQuery);