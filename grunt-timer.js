var duration = require("duration");
require("colors");

exports = module.exports = (function () {
    "use strict";
    var timer = {}, grunt, hooker, last, task,
        total = 0,
        logAll = false,
        deferLogs = false,
        totalOnly = false,
        friendlyTime = false,
        log,
        deferredMessages = [];

    var defaultLogger = function (task, dur) {
        if (task) {
            grunt.log.writeln(("Task '" + task + "' took " + getDisplayTime(dur)).magenta);
        } else {
            grunt.log.writeln(("All tasks took " + getDisplayTime(total)).magenta.bold);
        }
    }
    
    var getDisplayTime = function (s) {
        if (!friendlyTime) {
            return s + "ms";
        }
        if (s < 1000) {
            return "<1 second";
        }

        var ms = s % 1000;
        s = (s - ms) / 1000;
        var secs = s % 60;
        s = (s - secs) / 60;
        var mins = s % 60;
        var hrs = (s - mins) / 60;

        return (hrs ? hrs + (hrs > 1 ? " hours " : " hour ") : "") +
            (mins ? mins + (mins > 1 ? " minutes " : " minute ") : "") +
            secs + (secs > 1 ? " seconds " : " second ");
    };

    var logCurrent = function (error) {
        var dur = new duration(last).milliseconds;
        if (dur > 2 || logAll) {
            if (!totalOnly){
                if (deferLogs) {
                    deferredMessages.push({ task: task, dur: dur, error: error });
                } else {
                    log(task, dur, error);
                }
            }
            addToTotal(dur);
        }
    };

    var logTotal = function (error) {
        log(undefined, total, error);
    };

    var addToTotal = function (ms) {
        total = total + ms;
    };

    var reportTotal = function (error) {
        logCurrent(error);
        if (deferLogs) {
            for (var i = 0; i < deferredMessages.length; i++) {
                var thisLog = deferredMessages[i];
                log(thisLog.task, thisLog.dur, thisLog.error);
            }
        }
        logTotal(error);
        hooker.unhook(grunt.log, "header");
        hooker.unhook(grunt.fail, "report");
        hooker.unhook(grunt.fail, "fatal");
        hooker.unhook(grunt.fail, "warn");
    };
    
    var reportTotalOnFailure = function () {
        reportTotal(true);
    }

    timer.init = function (_grunt, options) {
        grunt = _grunt;
        hooker = grunt.util.hooker;
        total = 0;
        options = options || {};

        logAll       = !!options.logAll;
        deferLogs    = !!options.deferLogs;
        friendlyTime = !!options.friendlyTime;
        totalOnly    = !!options.totalOnly;
        log          = options.log || defaultLogger;

        hooker.hook(grunt.log, "header", function () {
            if (!task) {
                last = new Date();
                task = grunt.task.current.nameArgs;
            }
            if (task === grunt.task.current.nameArgs) {
                return;
            }
            logCurrent();
            task = grunt.task.current.nameArgs;
            last = new Date();
        });

        // Hooks normal exit with no warnings, or normal exit with warnings when --force thrown
        hooker.hook(grunt.fail, "report", reportTotal);
        
        // Hooks fatal errors, and displays times before the final error message
        hooker.hook(grunt.fail, "fatal", reportTotalOnFailure);
        hooker.hook(grunt, "fatal", reportTotalOnFailure);
        
        // Hooks warnings when --force is not thrown, and displays times before the warning message.
        if (!grunt.option('force')) {
            hooker.hook(grunt.fail, "warn", reportTotalOnFailure);
            hooker.hook(grunt, "warn", reportTotalOnFailure);
        }
    };

    return timer;
})();