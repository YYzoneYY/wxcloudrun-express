process.env.WX_APPID = 'wx05942a03fb56a115';
process.env.WX_APPSECRET = '61ce1d0347c678153316a8157c8fe02a';

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter } = require("./db");
const axios = require('axios');
const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

let accessTokenCache = null;
let accessTokenExpireTime = 0;

let ticketCache = null;
let ticketExpireTime = 0;

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }
  res.send({
    code: 0,
    data: await Counter.count(),
  });
});

// 获取计数
app.get("/api/count", async (req, res) => {
  const result = await Counter.count();
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

// 获取jsapi_ticket
app.get("/api/wx_jsapi_ticket", async (req, res) => {
  let ticket = ticketCache;
  let ticketExpireTime = ticketExpireTime;
  if (!ticket || Date.now() >= ticketExpireTime) {
    // 如果ticket不存在或者已过期，重新获取ticket
    let accessToken = accessTokenCache;
    if (!accessToken || Date.now() >= accessTokenExpireTime) {
      // 如果accessToken不存在或者已过期，重新获取accessToken
      const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WX_APPID}&secret=${process.env.WX_APPSECRET}`;
      const tokenResult = await axios.get(tokenUrl);
      accessToken = tokenResult.data.access_token;
      accessTokenExpireTime = Date.now() + 7200 * 1000; // 设置accessToken过期时间为7200秒后
      accessTokenCache = accessToken;
    }

    const ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
    const ticketResult = await axios.get(ticketUrl);
    ticket = ticketResult.data.ticket;
    ticketExpireTime = Date.now() + 7200 * 1000; // 设置ticket过期时间为7200秒后
    ticketCache = ticket;
  }

  res.send({
    ticket,
    expires_in: ticketExpireTime - Date.now(), // 返回ticket的剩余过期时间
  });
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
