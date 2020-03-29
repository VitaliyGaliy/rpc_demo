(async function() {
  const {ConferenceApi, Utils, ERROR} = window;
  const $ = document.querySelector.bind(document);
  const $$ = document.querySelectorAll.bind(document);
  let playback;
  const audioPublish = $('#audioPublish');
  const videoPublish = $('#videoPublish');
  $$('.publish-checkbox').forEach(b =>
    b.addEventListener('change', async event => {
      if (playback) {
        const kinds = [];
        if (audioPublish.checked) {
          kinds.push('audio');
        }
        if (videoPublish.checked) {
          kinds.push('video');
        }
        await playback.updateKinds(kinds);
      } else {
        $$('.capture-button').forEach(
          b => (b.disabled = !audioPublish.checked && !videoPublish.checked),
        );
      }
    }),
  );
  const conferenceIds = {};
  $('#get-stats').addEventListener('click', async event => {
    if (playback) {
      const ids = [];
      if (audioPublish.checked && conferenceIds['audio']) {
        ids.push(conferenceIds['audio']);
      }
      if (videoPublish.checked && conferenceIds['video']) {
        ids.push(conferenceIds['video']);
      }
      if (ids.length) {
        console.log(await playback['api'].consumersStats({ids}));
      }
    }
  });
  $('#subscribe').addEventListener('click', async event => {
    $('#subscribe').disabled = true;
    event.preventDefault();
    const br = $(`#playback-video-bit-rate`);
    const connectionBox = $('#connection-box');
    try {
      const kinds = [];
      if (audioPublish.checked) {
        kinds.push('audio');
      }
      if (videoPublish.checked) {
        kinds.push('video');
      }
      playback = new ConferenceApi({
        kinds,
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
        .on('newConsumerId', ({id, kind}) => {
          conferenceIds[kind] = id;
          console.log('newConsumerId', id, kind);
        });
      const v = $('#playback-video');
      const play = () => {
        console.log('trying to play');
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
      };
      const mediaStream = await playback.subscribe();
      v.srcObject = mediaStream;
      if (Utils.isSafari) {
        const onStreamChange = () => {
          v.srcObject = new MediaStream(mediaStream.getTracks());
          play();
        };
        mediaStream.addEventListener('addtrack', onStreamChange);
        mediaStream.addEventListener('removetrack', onStreamChange);
      } else if (Utils.isFirefox) {
        v.addEventListener('pause', play);
      }

      play();

      $('#stop-playing').disabled = false;
      $('#pause-unpause').disabled = false;
      $('#get-stats').disabled = false;
    } catch (e) {
      if (e.response && e.response.status && ERROR[e.response.status]) {
        alert(ERROR[e.response.status]);
      }
      console.log(e);
      if (playback) {
        await playback.close();
      }
    }
  });

  $('#stop-playing').addEventListener('click', function(event) {
    event.preventDefault();
    if (playback) {
      playback.close();
      $('#stop-playing').disabled = true;
      $('#pause-unpause').disabled = true;
      $('#subscribe').disabled = false;
      $('#get-stats').disabled = true;
    }
  });
  $('#pause-unpause').addEventListener('click', async function(event) {
    event.preventDefault();
    if (playback) {
      this.disabled = true;
      await playback.pause();
      await new Promise(resolve => setTimeout(resolve, 500));
      await playback.resume();
      this.disabled = false;
    }
  });
})();
