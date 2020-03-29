(async function() {
  const {ConferenceApi, Utils, ERROR} = window;
  const $ = document.querySelector.bind(document);
  const $$ = document.querySelectorAll.bind(document);
  const playbacks = [];
  $('#subscribe').addEventListener('click', async event => {
    $('#subscribe').disabled = true;
    event.preventDefault();
    let isError = false;
    for (let i = 0; i < 3; i++) {
      try {
        const br = $(`#playback-video-bit-rate-${i}`);

        playbacks[i] = new ConferenceApi({
          stream: 'stream1',
          token:
            'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImV4cCI6MTU4NDc3NzYzNywiaWF0IjoxNTgzNzQwODM3fQ._eV0BLlDp4aNgXf8JhE2naR6YvaZzvCpBsH7WIasgAEHfDrrymvPX43iWaQunufVF-BZMBwrOhufb-uIVoby8A',
        }).on('bitRate', ({bitRate, kind}) => {
          if (kind === 'video') {
            br.innerText = Math.round(bitRate).toString();
            if (bitRate > 0) {
              br.classList.add('connected');
            } else {
              br.classList.remove('connected');
            }
          }
        });
        const v = $(`#playback-video-${i}`);
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
        const mediaStream = await playbacks[i].subscribe();
        await playbacks[i].setPreferredLayers({
          spatialLayer: i,
          temporalLayer: 0,
        });
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
      } catch (e) {
        if (e.response && e.response.status && ERROR[e.response.status]) {
          alert(ERROR[e.response.status]);
        }
        console.log(e);
        if (playbacks[i]) {
          await playbacks[i].close();
        }
      }
      if (!isError) {
        $('#stop-playing').disabled = false;
      }
    }
  });

  $('#stop-playing').addEventListener('click', function(event) {
    event.preventDefault();
    for (let i = 0; i < 3; i++) {
      if (playbacks[i]) {
        playbacks[i].close();
      }
      $('#stop-playing').disabled = true;
      $('#subscribe').disabled = false;
    }
  });
})();
