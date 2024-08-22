const puppeteer = require("puppeteer");
const Sequelize = require("sequelize");
const delayRandom = require("delay-random");
const axios = require("axios");

const db = require("./config/Database.js");

const M_product = require("./models/M_ProductModel.js");
const M_product_record = require("./models/M_ProductRecordModel.js");
const M_keyword_hint = require("./models/KeywordHintModel.js");

const ip_proxy = "";
const username = "";
const password = "";

module.exports = {
  scrape: function (time) {
    (async () => {
      await db.sync({
        alter: true,
      });
      let time = "13:00";
      let jam = time;
      if (jam === undefined) {
        return;
      }
      let kata_kunci = await db.query(
        `SELECT id,	keyword, status,	jt.jadwal FROM keyword, 	JSON_TABLE ( jadwal, '$[*]' COLUMNS ( jadwal VARCHAR ( 5 ) PATH '$' ) ) AS jt where jt.jadwal = "${jam}" and status = 1 and mp = "lazada" order by  RAND()`,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );
      const data_product = [];
      const data_record = [];

      let i = 1;

      let total_kw = 0;
      for (let j = 0; j < kata_kunci.length; j++) {
        let keyword_ketik = kata_kunci[j].keyword;
        const browser = await puppeteer.launch({
          headless: false,
          slowMo: 100,
          args: [`--proxy-server=${ip_proxy}`],
        });
        const page = await browser.newPage();
        await page.authenticate({
          username,
          password,
        });
        const client = await page.target().createCDPSession();

        await client.send("Network.setCacheDisabled", {
          cacheDisabled: true,
        });
        if (keyword_ketik === undefined) {
          return;
        }
        while (true) {
          try {
            await page.goto("https://www.lazada.co.id/", {
              // await page.goto("file:///E:/xampp/htdocs/api_node/test.html", {
              waitUntil: [
                "load",
                "domcontentloaded",
                "networkidle0",
                "networkidle2",
              ],
              timeout: 100000,
            }); //membuka url

            await page.type('input[id="q"]', keyword_ketik, {
              delay: 50,
            });

            await page.waitForTimeout(3000); //delay 2 detik

            var hint = await page.$$eval("form div div div a", (elements) =>
              elements.map((item) => item.textContent)
            );

            const data_hint = [];
            for (let z = 0; z < hint.length; z++) {
              let hint_old = await M_keyword_hint.findOne({
                where: {
                  keyword: keyword_ketik,
                  hint: hint[z],
                  mp: "lazada",
                },
              });
              if (hint_old == null) {
                data_hint.push({
                  keyword: keyword_ketik,
                  hint: hint[z],
                  mp: "lazada",
                });
              }
            }
            await M_keyword_hint.bulkCreate(data_hint);

            await page.keyboard.press("Enter"); // Enter Key

            await page.waitForNavigation({
              waitUntil: [
                "load",
                "domcontentloaded",
                "networkidle0",
                "networkidle2",
              ],
              timeout: 100000,
            });

            var product = await page.$$eval(
              'div[data-qa-locator="product-item"][data-tracking="product-card"]  a[age="0"]',
              (elements) => elements.map((item) => item.textContent)
            );
            const products = [];
            product.forEach((row) => {
              dt = row.replace(/  |\r\n|\n|\r/gm, " ").replace(/\s\s+/g, " ");
              if (dt.replace(/\s/g, "").length) {
                products.push(dt);
              }
            });
            // console.log(products);

            var id = await page.$$eval(
              'div[data-qa-locator="product-item"][data-tracking="product-card"]',
              (elements) =>
                elements.map((item) => item.getAttribute("data-item-id"))
            );
            // console.log(id);

            for (let z = 0; z < 40; z++) {
              data_product.push({
                mp: "lazada",
                judul: products[z],
                itemId: id[z],
              });

              data_record.push({
                mp: "lazada",
                itemId: id[z],
                keyword: keyword_ketik,
              });
            }

            await M_product.bulkCreate(data_product, {
              updateOnDuplicate: ["itemId"],
            });
            await M_product_record.bulkCreate(data_record);

            await page.waitForTimeout(5000); //delay 2 detik
            await delayRandom(5000, 10000);
            await browser.close();
            break;
          } catch (e) {
            console.log("ERROR lazada lemot ke " + i);
            console.error(e);
            // await page.reload(url_shopee);
            i++;
            continue;
          }
        }
        await delayRandom(20000, 50000); // delay random
        total_kw++;
        console.log(`Sukses kata kunci ke ${total_kw} : ${keyword_ketik}`);
      }

      axios
        .post(
          "https://api.telegram.org/bot5747843121:AAHbtFtkBNcW0pzhK5LWE3WfYb-W5fkdpgw/sendmessage",
          {
            chat_id: "-751741235",
            text: `${total_kw} kata kunci, jam ${jam}, lazada, sukses`,
          }
        )
        .then((res) => {
          console.log(`statusCode: ${res.status}`);
          // process.exit();
        })
        .catch((error) => {
          console.error(error);
        });
    })().catch((err) => console.error(err));
  },
};
