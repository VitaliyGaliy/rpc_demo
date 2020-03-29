(async function() {
  const {ConferenceApi, Utils, ERROR} = window;
  const $ = document.querySelector.bind(document);
  const $$ = document.querySelectorAll.bind(document);
  let capture, stream;
  let screenshare = false;
  const audioPublish = $('#audioPublish');
  const videoPublish = $('#videoPublish');
  const simulcast = $('#simulcast');
  const connectionBox = $('#connection-box');
  $$('.publish-checkbox').forEach(b =>
    b.addEventListener('change', async event => {
      console.log('change', b.id);
      if (stream && capture) {
        if (!audioPublish.checked) {
          const tracks = stream.getAudioTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            capture.removeTrack(track);
          }
        } else if (!stream.getAudioTracks().length) {
          const _stream = await Utils.getUserMedia(
            {audio: true, video: false},
            screenshare,
          );
          const tracks = _stream.getAudioTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            capture.addTrack(track);
          }
        }
        if (!videoPublish.checked) {
          const tracks = stream.getVideoTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            capture.removeTrack(track);
          }
        } else if (!stream.getVideoTracks().length) {
          const _stream = await Utils.getUserMedia(
            {audio: false, video: true},
            screenshare,
          );
          const tracks = _stream.getVideoTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            capture.addTrack(track);
          }
        }
      } else {
        $$('.capture-button').forEach(
          b => (b.disabled = !audioPublish.checked && !videoPublish.checked),
        );
      }
    }),
  );
  const conferenceIds = {};
  $('#get-stats').addEventListener('click', async event => {
    if (capture) {
      const ids = [];
      if (audioPublish.checked && conferenceIds['audio']) {
        ids.push(conferenceIds['audio']);
      }
      if (videoPublish.checked && conferenceIds['video']) {
        ids.push(conferenceIds['video']);
      }
      if (ids.length) {
        console.log(await capture['api'].producersStats({ids}));
      }
    }
  });
  $$('.capture-button').forEach(b =>
    b.addEventListener('click', async event => {
      event.preventDefault();
      if (!audioPublish.checked && !videoPublish.checked) {
        return;
      }
      $$('.capture-button').forEach(b => (b.disabled = true));
      simulcast.disabled = true;
      screenshare = b.id === 'screenshare';
      stream = await Utils.getUserMedia(
        {audio: audioPublish.checked, video: videoPublish.checked},
        screenshare,
      );
      const br = $(`#playback-video-bit-rate`);
      const bitrate = parseInt($('#bitrateInput').value);
      try {
        capture = new ConferenceApi({
          maxIncomingBitrate: bitrate || 0,
          simulcast: simulcast.checked,
          stream: 'stream1',
          token:
            'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NDc3NzYzNywiaWF0IjoxNTgzNzQwODM3fQ._eV0BLlDp4aNgXf8JhE2naR6YvaZzvCpBsH7WIasgAEHfDrrymvPX43iWaQunufVF-BZMBwrOhufb-uIVoby8A',
        })
          .on('bitRate', ({bitRate, kind}) => {
            if (kind === 'video') {
              br.innerText = Math.round(bitRate).toString();
              if (bitRate > 0) {
                br.classList.add('connected');
              } else {
                br.classList.remove('connected');
              }
            }
          })
          .on('connectionstatechange', ({state}) => {
            console.log('connectionstatechange', state);
            if (state === 'connected') {
              connectionBox.classList.add('connected');
            } else {
              connectionBox.classList.remove('connected');
            }
          })
          .on('newProducerId', ({id, kind}) => {
            conferenceIds[kind] = id;
            console.log('newProducerId', id, kind);
          });
        const v = $('#capture-video');
        v.srcObject = await capture.publish(stream);
        let playPromise = v.play();
        if (playPromise !== undefined) {
          playPromise
            .then(_ => {})
            .catch(error => {
              v.muted = true;
              v.play().then(
                () => {
                  console.log('errorAutoPlayCallback OK');
                },
                error => {
                  console.log('errorAutoPlayCallback error again');
                },
              );
            });
        }

        $('#stop-publish').disabled = false;
        $('#get-stats').disabled = false;

        // await capture.api.startRestreaming({stream:"stream1",targetUrl:'https://lh2.codeda.com'});
        //await capture.startRecording();
      } catch (e) {
        if (e.response && e.response.status && ERROR[e.response.status]) {
          console.log('ERROR', ERROR[e.response.status]);
          alert(ERROR[e.response.status]);
        }
        console.log(e);
        if (capture) {
          await capture.close();
        }
      }
    }),
  );
  $('#update-bitrate').addEventListener('click', async event => {
    if (capture) {
      const bitrate = parseInt($('#bitrateInput').value);
      await capture.setMaxPublisherBitrate(bitrate || 0);
    }
  });
  $('#stop-publish').addEventListener('click', function(event) {
    event.preventDefault();
    if (capture) {
      capture.close();
      $('#stop-publish').disabled = true;
      $('#get-stats').disabled = true;
      $$('.capture-button').forEach(b => (b.disabled = false));
      simulcast.disabled = false;
    }
  });
})();
