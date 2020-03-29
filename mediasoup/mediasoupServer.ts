import {conf} from './config/conf';
import {createServer} from 'http';
import {join as pathJoin} from 'path';
import * as express from 'express';
import * as cors from 'cors';
import * as console_stamp from 'console-stamp';
import {ACTION, API_OPERATION, ERROR, PATH} from './config/constants';
import {MediasoupHandler} from './ms/mediasoup-handler';
import {makeDirIfNotExists} from './utils/file-utils';
import {json as jsonBodyParser} from 'body-parser';
import * as router from 'router';
import * as jwt from 'express-jwt';
import * as jsonwebtoken from 'jsonwebtoken';

console_stamp(console, '[HH:MM:ss.l]');
makeDirIfNotExists(conf.recording.path).then(() => {
  const apiHandler = new MediasoupHandler(conf.mediasoup);
  const app = express();
  app.use(cors());
  app.use(jsonBodyParser());
  app.use(router());
  const httpsServer = createServer(app);
  httpsServer.listen(conf.port, '127.0.0.1', () => {
    console.log(`Server is listening on port ${conf.port}`);
  });
  app.use(`/${PATH.RECORDINGS}`, express.static(conf.mediasoup.recording.path));
  app.use(express.static(pathJoin(__dirname, PATH.FRONT)));
  app.post(
    `/${PATH.MEDIASOUP}/:action`,
    jwt({secret: conf.auth.secret, algorithm: conf.auth.algorithm}),
    async (req, res) => {
      const {action} = req.params;
      const auth = req['user'];
      console.log('got message', req['user'], action, JSON.stringify(req.body));
      let response = (data, status = 200) => {
        res.status(status).send(data);
        console.log('sent message', action, JSON.stringify(data));
      };
      let error = (errorId?: ERROR, error?) => {
        response(error, errorId);
      };
      if (
        action === ACTION.PRODUCE &&
        parseInt(auth.operation) !== API_OPERATION.PUBLISH
      ) {
        return error(ERROR.INVALID_OPERATION);
      }
      try {
        const res = (await apiHandler[req.params.action](req.body)) || {};
        response(res);
      } catch (err) {
        if (err) {
          console.error(JSON.stringify(err));
        }
        error(err.errorId, err.message);
      }
    },
  );

  app.get(`/auth/:stream/:operation`, async (req, res) => {
    res.send(
      jsonwebtoken.sign(
        {...req.params, exp: Math.floor(Date.now() / 1000 + 12 * 24 * 3600)},
        conf.auth.secret,
        {algorithm: conf.auth.algorithm},
      ),
    );
  });
});
