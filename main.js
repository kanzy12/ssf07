//load node modules
const express = require('express');
const exphbs = require('express-handlebars');
const mysql = require('mysql');

//set tunables
const PORT = parseInt(process.argv[2] || 3000);
const appsPerPage = 12;

//sql queries
const sqlSelectDistinctCategory = 'select distinct category from apps';
const sqlSelectCategory = `select * from apps where category = ? limit ${appsPerPage} offset ?`;
const sqlSelectCategoryCount = 'select count(*) as numApps from apps where category = ?';

//create mysql connection pool
const pool = mysql.createPool(
    require('./config.json')
);

//sql query helper functions
const makeQuery = (pool, query) => {
    return ((params) => {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) {
                    reject (err);
                }
                else {
                    conn.query(query, params || [], (err, result) => {
                        conn.release();

                        if (err) {
                            reject (err);
                        }
                        else {
                            resolve(result);
                        }
                    });
                }
            });
        });
    });
};

const getCategories = makeQuery(pool, sqlSelectDistinctCategory);
const getAppsOfCategory = makeQuery(pool, sqlSelectCategory);
const getNumAppsOfCategory = makeQuery(pool, sqlSelectCategoryCount);

//get instance of express
app = express();

//initialise handlebars stuff
const hbs = exphbs.create(
    {
        helpers: {
            rating: (rating) => {
                let result = '';
                rating = parseInt(rating);
                for (let i = 0; i < rating; i++){
                    result += '<i class="fas fa-star"></i>';
                }

                return result;
            }
        },
        defaultLayout: 'main.hbs'
    }
);
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

//serve category page
app.get('/category', (req, res) => {
    let category = req.query['category'];
    let page = parseInt(req.query['page']);

    if (!page){
        page = 0;
    }

    console.log('Category: ', category);

    Promise.all([getNumAppsOfCategory([category]), getAppsOfCategory([category, page * appsPerPage])])
    .then(result => {
        let numApps = parseInt(result[0][0]['numApps']);

        let appList = result[1];
        let splitResult = [];
        for (let i = 0; i < appList.length; i += 4)
        {
            splitResult.push(appList.slice(i, i + 4));
        }

        res.status(200);
        res.type('text/html');
        res.render('category',
        {
            apps: splitResult,
            category: category,
            noPrevious: page <= 0,
            previousPage: page - 1,
            noNext: page >= Math.floor(((numApps - 1) / appsPerPage)),
            nextPage: page + 1,
            firstNum: page * appsPerPage + 1,
            lastNum: Math.min((page + 1) * appsPerPage, numApps),
            numApps: numApps
        });
    })
    .catch(err => {
        console.log(err);
    })
})

//serve main page
app.get(['/', '/index.html'], (req, res) => {
    getCategories()
    .then(result => {
        res.status(200);
        res.type('text/html');
        res.render('query',
        {
            categories: result
        });
    })
    .catch(err => {
        console.log(err);
    });
});

//serve public files
app.get(/.*/, express.static(__dirname + '/public'));

//start the server
app.listen(PORT, () => {
    console.info(`App started on port ${PORT} at ${new Date()}`);
});