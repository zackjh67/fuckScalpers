const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');
const exec = require('await-exec');

// TODO build similar sku checker bot that finds new skus with certain search filter, say 3080/3090
const knownSkus = [];
const watchTheseSkus = [6429434, 6418599];

const addToCartBtnSelector = 'add-to-cart-button';
const inStockSelector = "btn-primary";
const outOfStockSelector = "btn-disabled";

const alertzyAccountKey = 'givjzq9zxy419a8';

const refreshInterval = 10000;

function buildAlertzy(title, message) {
  return `curl -s --form-string "accountKey=${alertzyAccountKey}" --form-string "title=${machineTitle}: ${title}" --form-string "message=${message}" https://alertzy.app/send
`
}

const machineTitle = 'Surface Book';

function buildSkuUrl(sku) {
  return `https://www.bestbuy.com/site/searchpage.jsp?st=${sku}`;
}

async function kmap(collection, fn) {
  return new Promise(async function (resolve) {
    const newCollection = [];
    for (let i=0; i<collection.length; i+=1) {
      newCollection.push(await fn(collection[i], i));
    }
    resolve(newCollection);
  });
}

async function keach(collection, fn) {
  return new Promise(async function (resolve) {
    for (let i=0; i<collection.length; i+=1) {
      await fn(collection[i], i);
    }
    resolve();
  });
}

function ktimeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function now() {
  const currentDate = new Date();
  const dateTime = "Last Sync: " + currentDate.getDate() + "/"
    + (currentDate.getMonth()+1)  + "/"
    + currentDate.getFullYear() + " @ "
    + currentDate.getHours() + ":"
    + currentDate.getMinutes() + ":"
    + currentDate.getSeconds();

  return dateTime;
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });

  // open up chromium instances for each sku to watch
  _.each(watchTheseSkus, async (sku) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    const destUrl = buildSkuUrl(sku);

    // TODO write these to a log eventually i guesss
        console.log(`Pinging SKU: ${sku}\n`);
        await page.goto(destUrl);

        let shouldRun = true;

        while(shouldRun) {
          const cartButton = (await page.$$(`.${addToCartBtnSelector}`))[0];
          const buttonClasses = (await page.evaluate(e => e.classList, cartButton));

          // wait 2 seconds for shit to load
          console.log(`sku ${sku} waiting 2 seconds`);
          await ktimeout(2000);

          const inStock = _.find(buttonClasses, e => e === inStockSelector);
          if (inStock) {
            console.log(`sku ${sku} in stock at: %o`, now());
            cartButton.click();
            await exec(
              buildAlertzy(sku, 'Add to cart button clicked!')
            );
          }

          const outOfStock = _.find(buttonClasses, e => e === outOfStockSelector);
          if (outOfStock) {
            console.log(`sku ${sku} Out of stock at: %o`, now());
            // await exec(
            //   buildAlertzy(sku, 'out of fucking stock lol')
            // );
          }

          if (!outOfStock && !inStock) {
            console.log(`sku ${sku} irregular button found!: %o`, buttonClasses);
            await exec(
              buildAlertzy(sku, 'Irregular button found!')
            );
          }

          // wait 10 seconds then refresh
          console.log(`sku ${sku} waiting 10 seconds`);
          // TODO add random seconds modifier to refreshinterval second so it seems less bott-ey and predictable
          await ktimeout(refreshInterval);
          if (outOfStock) {
            // refresh page if out of stock otherwise quit and wait for human
            await page.reload(destUrl);
          } else {
            shouldRun = false;
          }
        }
  });

  console.log('fuckin done');
})();

// error if u cant add to ur cart
// i think this was actually caused by a fucking popup blocker
/*
* <div class="c-alert c-alert-level-danger"><div class="c-alert-icon"><i><svg aria-hidden="true" role="img" viewBox="0 0 100 100" fill="#fff" height="24" width="24"><use href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon" xlink:href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon"></use></svg><span class="sr-only" tabindex="-1">Error</span></i></div><div class="c-alert-content"><p>There was a problem adding your product to cart.</p></div></div>
*
* */