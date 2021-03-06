/**
 * CSS-defined parallax.
 *
 * @module     DNA Parallax
 * @author     Daniel Sevcik <sevcik@webdevelopers.cz>
 * @copyright  2018 Daniel Sevcik
 * @since      2019-01-26 13:05:24 UTC
 */
(function ($, window) {
    var $window = $(window);

    // Hook on scroll
    var lock = 0;
    $window.on("scroll", function () {
        if (lock++) return; // prevent simultaneous recalcs
        window.requestAnimationFrame(function () {
            $('[parallax]').parallax();
            lock = 0;
        });
    });

    // jQuery plugin - progress animation or force reinitialization
    // $(el).parallax(["init"]);
    $.fn.parallax = function (param) {
        return this.each(function () {
            // Initialize
            if (!this.parallax || param == 'init') {
                this.parallax = new DnaParallax(this);
            }
            this.parallax.step();
        });
    };

    // ------------------------------------------------------------------------

    /**
     * Parallax object that is stored on element in element.parallax property.
     *
     * @param DOMElement element to be animated
     */
    function DnaParallax(element) {
        this.$element = $(element);

        // Find container
        this.$container = this.$element.closest('.parallax-container');
        if (!this.$container.length) this.$container = this.$element;

        // Parse settings
        this.animName = this.$element.attr('parallax');
        this.anim = new DnaAnim(this.animName);
    }

    /**
     * The element to be animated.
     *
     * @var jQuery
     */
    DnaParallax.prototype.$element = null;

    /**
     * Container element to calculate progress. It is any parent with
     * .parallax-container class or self.

     * @var jQuery
     */
    DnaParallax.prototype.$container = null;

    /**
     * Animation name as specified by @parallax attribute.
     *
     * @var string
     */
    DnaParallax.prototype.animName = null;

    /**
     * Object with animation settings.
     *
     * @var DnaAnim
     */
    DnaParallax.prototype.anim = null;

    /**
     * Current animation progress state.
     *
     * @var float (1 = 100%)
     */
    DnaParallax.prototype.progress = null;

    /**
     * Move animation in given state.
     *
     * @return void
     */
    DnaParallax.prototype.step = function () {
        this.calculateProgress();

        var style = {};
        for (var i = 0; i < this.anim.props.length; i++) {
            var prop = this.anim.props[i];
            style[prop.name] = prop.get(this.progress);
        }

        this.$element.css(style);
    };

    /**
     * Calculates current progress based on this.$container's position
     * and updates this.progress property with calculated value.
     *
     * Also updates @parallax-progress attribute on the element.
     *
     * @return void
     */
    DnaParallax.prototype.calculateProgress = function () {
        var containerTop = this.$container.offset().top;
        var containerHeight = this.$container.height();
        var viewHeight = $window.height();
        var viewTop = $window.scrollTop();
        var progress0, progress100;

        // 0%: container's top is alligned with view's bottom
        // 100%: container's bottom is alligned with view's top
        progress0 = containerTop - viewHeight;
        progress100 = containerTop + containerHeight;
        this.progress = (viewTop - progress0) / (progress100 - progress0);

        // Round to 4 digits, should be enough for smoothness and avoids loooong floats in debug
        this.progress = Math.round(this.progress * 1000000) / 1000000;

        if (this.progress > 1) this.progress = 1;
        else if (this.progress < 0) this.progress = 0;

        this.$element.attr('parallax-progress', (Math.round(this.progress * 1000000) / 10000) + "%");
    };


    // ------------------------------------------------------------------------

    /**
     * Animation settings.
     *
     * @param string name CSS animation name
     */
    function DnaAnim(name) {
        var i, j;

        this.props = [];

        // Find animation object
        for (i = 0; !this.rule && i < document.styleSheets.length; ++i) {
            for (j = 0; !this.rule && j < document.styleSheets[i].cssRules.length; ++j) {
                if (document.styleSheets[i].cssRules[j].type == 7 && document.styleSheets[i].cssRules[j].name == name) {
                    this.rule = document.styleSheets[i].cssRules[j];
                }
            }
        }

        if (!this.rule) {
            throw new Error("Cannot find animation " + JSON.stringify(name));
        }

        // Extract keyframe styles
        var list = {};
        for (i = 0; i < this.rule.cssRules.length; i++) {
            var kf = this.rule.cssRules[i]; // @type CSSKeyframesRule
            var progress = parseFloat(kf.keyText) / 100;

            for (j = 0; j < kf.style.length; j++) {
                var n = kf.style[j];
                if (!list[n]) {
                    list[n] = new DnaProp(n);
                    this.props.push(list[n]);
                }
                list[n].add(progress, kf.style[n]);
            }
        }
        // console.log(this.props);
    }


    /**
     * Array of props.
     *
     * @var []
     */
    DnaAnim.prototype.props = null;

    /**
     * Animation rule object.
     *
     * @var CSSKeyframesRule
     */
    DnaAnim.prototype.rule = null;

    /**
     *
     * @param float progress (1=100%)
     * @return void
     */
    DnaAnim.prototype.getStyles = function (progress) {

    };

    // ------------------------------------------------------------------------

    /**
     * Holds animated property with values at specified keyframes.
     *
     * @param string name of the CSS property
     */
    function DnaProp(name) {
        this.name = name;
        this.list = [];
    }

    /**
     * Name of the CSS property
     *
     * @var string
     */
    DnaProp.prototype.name = null;

    /**
     * Values at given keyframes.
     *
     * @var []
     */
    DnaProp.prototype.list = null;

    /**
     * Assign new value to given keyframe
     *
     * @param float progress identifying the keyframe
     * @param string value
     * @return void
     */
    DnaProp.prototype.add = function (progress, styleText) {
        var re = /[+-]?[0-9]+(\.[0-9]+)?/g;
        var obj = {
            "progress": progress,
            "styleText": styleText,
            "values": (styleText.match(re) || []).map(function (v) {
                return parseFloat(v);
            }),
            "template": styleText.replace(re, '@')
        };

        for (var i = 0; i < this.list.length; i++) {
            if (this.list[i].progress == progress) {
                this.list[i] = obj;
                return;
            }
        }

        this.list.push(obj);
        this.list.sort(function (a, b) {
            return a.progress - b.progress;
        });
    };

    /**
     * Get value at given keyframe
     *
     * @param float progress identifying the keyframe
     * @return string recalculated value
     */
    DnaProp.prototype.get = function (progress) {
        var i, before, after;

        // Find closest keyframe definitions
        for (i = 0; i < this.list.length; i++) {
            var kf = this.list[i];
            if (kf.progress == progress) { // direct hit
                return kf.styleText;
            } else if (kf.progress < progress) {
                before = kf;
            } else { // kf.progress > progress
                after = kf;
                break;
            }
        }

        // Progress is outside of our definitions - use first or last as default
        if (!before) {
            return after.styleText;
        } else if (!after) {
            return before.styleText;
        }

        var template = before.template;
        var ratio = (progress - before.progress) / (after.progress - before.progress);

        for (i = 0; i < before.values.length; i++) {
            template = template.replace('@', before.values[i] + (after.values[i] - before.values[i]) * ratio);
        }

        return template;
    };

})(jQuery, window);