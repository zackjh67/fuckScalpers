const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');
const exec = require('await-exec');

// TODO build similar sku checker bot that finds new skus with certain search filter, say 3080/3090
const knownSkus = [];

// bestbuy uses sku numbers to identify products
const watchTheseSkus = [6430175, 6436219, 6429434, 6432447, 6432446];

const addToCartBtnSelector = 'add-to-cart-button';
const inStockSelector = "btn-primary";
const outOfStockSelector = "btn-disabled";

// change this. Uses service called Alertzy for push notifications to your mobile phone
// https://alertzy.app/
const alertzyAccountKey = '';

const refreshInterval = 10000;

function buildAlertzy(title, message, link, priority) {
  if (!alertzyAccountKey.length) return 'echo Alertzy not set up';
  return `curl -s --form-string "priority=${priority || 0}" --form-string "group=BestBuy" --form-string "accountKey=${alertzyAccountKey}" --form-string "title=${machineTitle}: ${title}" --form-string "message=${message}" ${(link && '--form-string "link=' + link + '"') || ''} https://alertzy.app/send
`
}

const machineTitle = 'Computer 1';

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
  const dateTime = "" + currentDate.getDate() + "/"
    + (currentDate.getMonth()+1)  + "/"
    + currentDate.getFullYear() + " @ "
    + currentDate.getHours() + ":"
    + currentDate.getMinutes() + ":"
    + currentDate.getSeconds();

  return dateTime;
}

// logic for actually checking the stock
async function doCheck(shouldRun, page, sku, destUrl) {
  while(shouldRun) {
    try {
      const cartButton = (await page.$$(`.${addToCartBtnSelector}`))[0];
      const buttonClasses = (await page.evaluate(e => e.classList, cartButton));

      // wait 2 seconds for shit to load
      console.log(`sku ${sku} waiting 2 seconds for full page load`);
      await ktimeout(2000);

      const inStock = _.find(buttonClasses, e => e === inStockSelector);
      if (inStock) {
        console.log(`$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ sku ${sku} in stock at: %o $$$$$$$$$$$$$$$$$$$$$$$$$$$$$`, now());
        cartButton.click();

        // IMPORTANT: bestbuy has this new queue thing to deter botters for certain items.
        // It has you wait until the button turns yellow again to actually click and add to your cart
        // Since I don't feel like figuring out when that happens, for now, this just checks if it is a special queue page or not, and lets
        // the user know that their action is required (click the button again when it turns yellow to actually add to cart)

        // wait 1 sec to let the message pop up
        await ktimeout(1000);
        const queueMessagePopupList = await page.$$(`.wait-overlay`);
        if (queueMessagePopupList.length) {
          const queueMessagePopup = queueMessagePopupList[0];
          const msgHeight = await page.evaluate(e => e.clientHeight, queueMessagePopup);
          // queue message has popped up. let user know they have to watch the button until it yellows
          if (msgHeight !== 0) {
            console.log(`sku ${sku} is special bby queue`);
            await exec(
              buildAlertzy(sku, 'Special queue alert! Must go manually click the button when yellow', destUrl, 2)
            );
            // I'm not sure if this message is present yet just hidden on every page, so if thats true and its
            // actually not a special queue item, things should functional normally even if the message is present but minimized
          } else {
            await exec(
              buildAlertzy(sku, 'Add to cart button clicked. Time to checkout!', destUrl, 2)
            );
          }
        } else {
          await exec(
            buildAlertzy(sku, 'Add to cart button clicked. Time to checkout!', destUrl, 2)
          );
        }
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
          buildAlertzy(sku, 'Irregular button found!', destUrl, 2)
        );
      }

      // wait 10 seconds then refresh
      console.log(`sku ${sku} waiting 10 seconds to refresh`);
      // TODO add random seconds modifier to refreshinterval second so it seems less bott-ey and predictable
      await ktimeout(refreshInterval);
      if (outOfStock) {
        // refresh page if out of stock otherwise quit and wait for human
        await page.reload(destUrl);
      } else {
        shouldRun = false;
      }
    } catch(e) {
      shouldRun = false;
      console.log('fuckin error!!!: %o', e);
      await exec(
        buildAlertzy(sku, `Error! ${e.toString()}`, destUrl)
      );
    }
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });

  // open up chromium instances for each sku to watch
  keach(watchTheseSkus, async (sku, i) => {
    if (i !== 0) {
      // stagger calls 3 seconds in between so bestbuy doesn't freak out
      const seconds = 3000 * i;
      console.log(`sku ${sku} waiting ${seconds/1000} seconds to start executing`);
      await ktimeout(3000 * i);
    }

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.setViewport({ width: 1280, height: 1024 });
    const destUrl = buildSkuUrl(sku);

    // TODO write these to a log eventually i guesss
        console.log(`Pinging SKU: ${sku}\n`);
        await page.goto(destUrl);

        let shouldRun = true;
        doCheck(shouldRun, page, sku, destUrl);
  });

  console.log('fuckin done');
})();

// error if u cant add to ur cart
// i think this was actually caused by a fucking popup blocker
/*
* <div class="c-alert c-alert-level-danger"><div class="c-alert-icon"><i><svg aria-hidden="true" role="img" viewBox="0 0 100 100" fill="#fff" height="24" width="24"><use href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon" xlink:href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon"></use></svg><span class="sr-only" tabindex="-1">Error</span></i></div><div class="c-alert-content"><p>There was a problem adding your product to cart.</p></div></div>
*
* */