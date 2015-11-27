(function (jwplayer) {
  var template = function (player, config, div) {
    var progressTracker = new VideoProgressTracker({
      progress_percent: config.progress_percent,
      progress_update_url: config.progress_update_url,
      frequency: config.frequency,
      player: player,
      video_duration_callback: player.getDuration,
      resume_from_last: config.resume_from_last,
      progress_only: config.progress_only,
      debug: config.debug
    });

    player.onReady(_setup);

    function _setup(event) {
      progressTracker.log("_setup");
      if (progressTracker.hasProgressUpdateUrl()) {
        player.onTime(_updateProgress);
      }
      if (progressTracker.hasValidOptions()) {
        player.onComplete(_completeUpdate);
        player.onPlay(_initPosition);
        player.onSeek(_onSeek);
      }
    }

    function _updateProgress(event) {
      progressTracker.log("_updateProgress");
      var current_position = parseInt(event.position);
      progressTracker.updateProgress(current_position);
    }

    function _initPosition(event) {
      progressTracker.log("_initPosition");
      progressTracker.initPosition();
    }

    function _completeUpdate(event) {
      progressTracker.log("_completeUpdate");
      var duration = parseInt(player.getDuration());
      progressTracker.updateProgress(duration, true);
    }

    function _onSeek(event) {
      progressTracker.log("_onSeek");
      if (event.offset) {
        progressTracker.updateProgress(parseInt(event.offset), true, true);
      }
    }
  };

  jwplayer().registerPlugin('jwplayer_tracker', template);

})(jwplayer);


function VideoProgressTracker(options) {
  this.progressPercentage = options.progress_percent;
  this.progressUpdateUrl = options.progress_update_url;
  this.prevPosition = 0;
  this.frequency = (options.frequency !== 'undefined' && options.frequency > 0) ? options.frequency : 10;
  this.player = options.player;
  this.video_duration_callback = options.video_duration_callback;
  this.resume_from_last = options.resume_from_last;
  this.debug = (options.debug === true) ? options.debug : false;
  this.total_session_duration = 0;
  this.progress_only = (options.progress_only === true) ? options.progress_only : false;
  this.session_id = guid();
  this.updated_progress_percent = 0;

  function guid() {
    function _p8(s) {
      var p = (Math.random().toString(16) + "000000000").substr(2, 8);
      return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
  }
}

VideoProgressTracker.prototype.videoDuration = function () {
  return this.video_duration_callback.apply(this.player);
};

VideoProgressTracker.prototype.initPrevPosition = function () {
  if (this.prevPosition === 0) {
    this.prevPosition = Math.floor((this.progressPercentage / 100) * this.videoDuration());
  }
};

VideoProgressTracker.prototype.initPosition = function () {
  if (this.prevPosition === 0 && this.resume_from_last === true) {
    this.prevPosition = Math.floor((this.progressPercentage / 100) * this.videoDuration());
  }

  if (this.currentPosition >= parseInt(this.videoDuration())) {
    this.currentPosition = 0;
  }
  if (this.prevPosition >= parseInt(this.videoDuration())) {
    this.prevPosition = 0;
  }

  if (this.resume_from_last === true) {
    this.player.seek(this.prevPosition);
    this.resume_from_last = false;
  }
};

VideoProgressTracker.prototype.hasValidOptions = function () {
  return this.hasProgressUpdateUrl();
};

VideoProgressTracker.prototype.hasProgressUpdateUrl = function () {
  return this.progressUpdateUrl !== "";
};

VideoProgressTracker.prototype.updateProgress = function (position, force, seeked) {
    console.log("Frequency - " + this.frequency);
  if (seeked) {
    var duration_played = this.currentPosition - this.prevPosition;
  }

  this.currentPosition = position;

  if (!seeked) {
    var duration_played = this.currentPosition - this.prevPosition;
  }

  if (force === true || (!this.progress_only && (duration_played >= this.frequency)) || (this.progress_only && (this.currentPosition - this.prevPosition) >= this.frequency)) {
    this.frequency_counter = 0;
    var video_duration = parseInt(this.videoDuration());

    //just an edge case
    if (this.currentPosition > video_duration) {
      this.currentPosition = video_duration;
    }

    this.updated_progress_percent = Math.round((this.currentPosition / video_duration) * 100);
    this.total_session_duration = this.total_session_duration + (duration_played > 0 ? duration_played : 0);

    this.saveProgress();
    this.prevPosition = this.currentPosition;
  }
};
VideoProgressTracker.prototype.saveProgress = function () {
  this.log("Updating progress to the server.");

  var self = this;

  var data = {
    session_id: self.session_id,
    previous_position: self.prevPosition,
    current_position: self.currentPosition,
    progress: self.updated_progress_percent,
    video_duration: parseInt(this.videoDuration()),
    total_session_duration: self.total_session_duration
  };

  this.log("progress info - " + console.log(JSON.parse(JSON.stringify(data))));

  $.ajax({
    url: this.progressUpdateUrl,
    method: 'POST',
    data: data,
    statusCode: {
      404: function () {
        self.log("URL not found.");
      },
      500: function () {
        self.log("Error on the server.");
      }
    }
  }).done(function (data) {
    self.log("Server update complete.");
    if (typeof server_update_callback !== 'undefined') {
      this.server_update_callback.apply(data);
    }
    ;
  });
};
VideoProgressTracker.prototype.log = function (msg) {
  if (this.debug === true && !(typeof window.console === 'undefined')) {
    console.log(msg);
  }
};
