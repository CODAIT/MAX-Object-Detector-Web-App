/*
 * Copyright 2018 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-env jquery */
/* eslint-env browser */

'use strict';

var threshold = 0.5;
var highlight = '';
var filter_list = [];
var predictions = [];

function update_label_icons() {
  $('.label-icon').hide();
  for (var i = 0; i < predictions.length; i++) {
    var icon_id = '#label-icon-' + predictions[i]['label_id'];
    if (predictions[i]['probability'] > threshold) {
      $(icon_id).show();
    }
  }
}

function display_box(i) {
  return predictions[i]['probability'] > threshold
    && !filter_list.includes(predictions[i]['label_id']);
}

function create_canvas() {
  // Create canvas
  var img = $('#user-image');
  var width = img.width();
  var height = img.height();
  var can_html = '<canvas id="image-canvas" width="'
    + width + '" height="' + height + '"></canvas>';
  $('#image-display').append(can_html);

  paint_canvas();
}

function paint_canvas() {
  if ($('#image-canvas').length) {
    update_label_icons();

    var ctx = $('#image-canvas')[0].getContext('2d');
    var can = ctx.canvas;
    ctx.clearRect(0, 0, can.width, can.height);

    ctx.font = '16px "IBM Plex Sans"';
    ctx.textBaseline = 'top';
    ctx.lineWidth = '3';

    for (var i = 0; i < predictions.length; i++) {
      if (display_box(i)) {
        if (predictions[i]['label_id'] === highlight) {
          ctx.strokeStyle = '#FFFFFF';
        } else {
          ctx.strokeStyle = '#00FF00';
        }
        paint_box(i, ctx, can);
      }
    }

    for (i = 0; i < predictions.length; i++) {
      if (display_box(i)) {
        paint_label_text(i, ctx, can);
      }
    }
  }
}

function paint_box(i, ctx, can) {
  ctx.beginPath();
  var corners = predictions[i]['detection_box'];
  var ymin = corners[0] * can.height;
  var xmin = corners[1] * can.width;
  var bheight = (corners[2] - corners[0]) * can.height;
  var bwidth = (corners[3] - corners[1]) * can.width;
  ctx.rect(xmin, ymin, bwidth, bheight);
  ctx.stroke();
}

function paint_label_text(i, ctx, can) {
  var probability = predictions[i]['probability'];
  var box = predictions[i]['detection_box'];
  var y = box[0] * can.height;
  var x = box[1] * can.width;
  var bwidth = (box[3] - box[1]) * can.width;

  var label = predictions[i]['label'];
  var prob_txt = (probability * 100).toFixed(1) + '%';
  var text = label + ' : ' + prob_txt;

  var tWidth = ctx.measureText(text).width;
  if (tWidth > bwidth) {
    tWidth = ctx.measureText(label).width;
    text = label;
  }
  var tHeight = parseInt(ctx.font, 10) * 1.4;

  if (predictions[i]['label_id'] === highlight) {
    ctx.fillStyle = '#FFFFFF';
  } else {
    ctx.fillStyle = '#00FF00';
  }
  ctx.fillRect(x, y, tWidth + 3, tHeight);

  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 1, y);
}

$(function() {
  // Image upload form submit functionality
  $('#file-upload').on('submit', function(event){
    // Stop form from submitting normally
    event.preventDefault();

    // Create form data
    var form = event.target;
    var file = form[0].files[0];
    var data = new FormData();
    data.append('image', file);
    data.append('threshold', 0);

    // Display image on UI
    var reader = new FileReader();
    reader.onload = function(event) {
      var file_url = event.target.result;
      var img_html = '<img id="user-image" src="' + file_url + '" />';
      $('#image-display').html(img_html);
    };
    reader.readAsDataURL(file);

    if ($('#file-input').val() !== '') {
      $('#file-submit').text('Detecting...');

      // Perform file upload
      $.ajax({
        url: '/model/predict',
        method: 'post',
        processData: false,
        contentType: false,
        data: data,
        dataType: 'json',
        success: function(data) {
          predictions = data['predictions'];
          create_canvas();
          if (predictions.length === 0) {
            alert('No Objects Detected');
          }
        },
        error: function(jqXHR, status, error) {
          alert('Object Detection Failed: ' + error);
        },
        complete: function() {
          $('#file-submit').text('Submit');
          $('#file-input').val('');
        },
      });
    }
  });

  // Update threshold value functionality
  $('#threshold-range').on('input', function() {
    $('#threshold-text span').html(this.value);
    threshold = $('#threshold-range').val() / 100;
    paint_canvas();
  });

  // Populate the label icons on page load
  $.get('/model/labels', function(result) {
    $.each(result['labels'], function(i, label) {
      $('#label-icons').append($('<img>', {
        class: 'label-icon',
        id: 'label-icon-' + label.id,
        title: label.name,
        src: '/img/cocoicons/' + label.id + '.jpg',
      }));
      console.log(label.id + '.jpg');
    });

    // Add an "onClick" for each icon
    $('.label-icon').on('click', function() {
      var this_id = $(this).attr('id').match(/\d+$/)[0];
      if ($(this).hasClass('hide-label')) {
        $(this).removeClass('hide-label');
        filter_list.splice(filter_list.indexOf(this_id), 1);
      } else {
        $(this).addClass('hide-label');
        filter_list.push(this_id);
      }
      paint_canvas();
    });

    // Add mouse over for each icon
    $('.label-icon').hover(function() {
      highlight = $(this).attr('id').match(/\d+$/)[0];
      paint_canvas();
    }, function() {
      highlight = '';
      paint_canvas();
    });
  });

});
