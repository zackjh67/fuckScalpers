
const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');
const exec = require('await-exec');
// const csvStringify = require('csv-stringify/lib/sync');

const thirty80List = 'https://www.bestbuy.com/site/computer-cards-components/video-graphics-cards/abcat0507002.c?id=abcat0507002&qp=gpusv_facet%3DGraphics%20Processing%20Unit%20(GPU)~NVIDIA%20GeForce%20RTX%203080';
const thirty90List = 'https://www.bestbuy.com/site/computer-cards-components/video-graphics-cards/abcat0507002.c?id=abcat0507002&qp=gpusv_facet%3DGraphics%20Processing%20Unit%20(GPU)~NVIDIA%20GeForce%20RTX%203090';
const knownSkus = [];
const watchTheseSkus = [6429434];

const addToCartBtnSelector = 'add-to-cart-button';
const normalCartBtnSelector = "btn-primary add-to-cart-button";
const soldOutCartBtnSelector = "btn-disabled add-to-cart-button";

const alertzyAccountKey = 'givjzq9zxy419a8';

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


function buildUrl(postalCode, radius, workPerformed, marketSegments) {
  return `http://code.metalocator.com/index.php?user_lat=0&user_lng=0&postal_code=${postalCode}&radius=${radius}&keyword=&workperformed=${encodeURIComponent(workPerformed)}&marketsegments=${encodeURIComponent(marketSegments)}&Itemid=2147&view=directory&layout=combined&tmpl=component&framed=1&parent_table=&parent_id=0&task=search_zip&search_type=point&_opt_out=&option=com_locator&ml_location_override=`;
}

/********************
 * Get workPerformedList
 await page.goto('http://code.metalocator.com/index.php?user_lat=0&user_lng=0&postal_code=49504&radius=10&keyword=&workperformed=Duct%20%26%20System%20Cleaning&marketsegments=Design+%2F+Build&Itemid=2147&view=directory&layout=combined&tmpl=component&framed=1&parent_table=&parent_id=0&task=search_zip&search_type=point&_opt_out=&option=com_locator&ml_location_override=');
 var workPerformedList = await page.$("#workperformed");
 var options = await workPerformedList.$$('option');
 await keach(options, async (option) => {
      var results = (await page.evaluate(e => e.textContent, option));
      console.log(results);
  });
 ****************/

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
  await keach(watchTheseSkus, async (sku) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // TODO write these to a log eventually i guesss
        console.log(`Pinging SKU: ${sku}\n`);
        await page.goto(buildSkuUrl(sku));

        // TODO read a key to stop this or something??
        let shouldRun = true;

        while(shouldRun) {
          const cartButton = (await page.$$(`.${addToCartBtnSelector}`))[0];
          const buttonClasses = (await page.evaluate(e => e.classList, cartButton));

          // wait 2 seconds for shit to load
          console.log(`sku ${sku} waiting 2 seconds`);
          await ktimeout(2000);

          const inStock = _.find(buttonClasses, e => e === 'btn-primary');
          if (inStock) {
            console.log(`sku ${sku} in stock at: %o`, now());
            cartButton.click();
            await exec(
              buildAlertzy(sku, 'Add to cart button clicked!')
            );
          }

          const outOfStock = _.find(buttonClasses, e => e === 'btn-disabled');
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
          await ktimeout(10000);
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