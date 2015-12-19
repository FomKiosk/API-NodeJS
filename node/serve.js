"use strict"
var config      = require("../config.json");
var mysql       = require("mysql");
var express     = require("express");
var app         = express();
var server      = require("http").createServer(app);
var bodyParser  = require('body-parser');
//var io      = require("socket.io")(server);


server.listen(config.app.port);

app.set("case sensitive routing", true);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// =====START=====
//      MySQL
// =====START=====
var connectionAPI = mysql.createConnection({
    host:       config.db.api.host,
    user:       config.db.api.user,
    password:   config.db.api.pass,
    database:   config.db.api.database
});
var connectionFom = mysql.createConnection({
    host:       config.db.fom.host,
    user:       config.db.fom.user,
    password:   config.db.fom.pass,
    database:   config.db.fom.database
});
connectionAPI.connect();
connectionFom.connect();
// ======END======
//      MySQL
// ======END======

app.use(headerHandler);

app.post("*", postHandler);

app.post("/check",  routeCheck);

app.post("/products/get", routeProductsGet);
app.post("/products/set/:productId([0-9]+)/visible", routeProductsSetVisible);

app.post("/categories/set/:categoryId([0-9]+)/visible", routeCategoriesSetVisible);

app.post("/orders/get/open", routeOrdersGetOpen);
app.post("/orders/get/finished", routeOrdersGetFinished);
app.post("/orders/set/:orderId([0-9]+)/done", routeOrdersSetDone);
app.post("/orders/create", routeOrdersCreate);

app.post("/stations/get", routeStationsGet);

app.post("/users/get/:barcode([0-9]+)", routeUsersGet)

app.use(routeDefault);

function makeRandomString() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 16; i++ ) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

function headerHandler(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    next();
}

function postHandler(req, res, next) {
    var response;
    if(typeof req.body.uid !== undefined && typeof req.body.secret !== undefined) {
        connectionAPI.query("SELECT kiosks.secret FROM kiosks WHERE kiosks.uid = ? LIMIT 1", [req.body.uid], function(err, result) {
            if(err) {
                console.log(err);
                response = {
                    error: "Authorisation failed!"
                }
                res.json(response);
            } else {
                if(result.length > 0) {
                    if(result[0].secret == req.body.secret) {
                        next();
                    } else {
                        response = {
                            error: "Authorisation failed!"
                        }
                        res.json(response);
                    }
                } else {
                    response = {
                        error: "Authorisation failed!"
                    }
                    res.json(response);
                }
            }
        });
    } else {
        response = {
            error: "Authorisation failed!"
        }
        res.json(response);
    }
}

function routeDefault(req, res) {
    res.status(404).end("404 Page not found!");
}

function routeCheck(req, res) {
    res.json({
        success: true
    });
}

function routeProductsGet(req, res) {
    connectionAPI.query("SELECT categories.id, categories.name, categories.visible, categories.sort FROM categories ORDER BY categories.sort", [], function(err, result) {
        var response = [];
        if(err) {
            console.log(err);
        } else {
            var categoriesId = [];
            result.forEach(function(row) {
                categoriesId.push(row.id);

                response.push({
                    id: row.id,
                    name: row.name,
                    visible: row.visible,
                    sort: row.sort,
                    products: []
                });
            });

            connectionAPI.query("SELECT products.id, products.name, products.price, products.visible, products.sort, products.categories_id, products.categories_id_sub FROM products WHERE products.categories_id IN (?) ORDER BY products.sort", [categoriesId], function (err, result) {
                if(err) {
                    console.log(err);
                } else {
                    result.forEach(function(product) {
                        response.forEach(function(category) {
                            if(category.id == product.categories_id) {
                                category.products.push({
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    visible: product.visible,
                                    sort: product.sort,
                                    categories_id_sub: product.categories_id_sub,
                                    image: "https://cdn.kassakiosk.be/images/products/"+product.id+".png"
                                });
                            }
                        });
                    });
                    res.json(response);
                }
            });
        }
    });
}

function routeProductsSetVisible(req, res) {
    var visible;
    if(req.body.visible == 1) {
        visible = 1;
    } else {
        visible = 0;
    }
    connectionAPI.query("UPDATE products SET products.visible = ? WHERE products.id = ?", [visible, req.params.productId], function(err, result) {
        var response;
        if(err) {
            console.log(err);
            response = {
                success: false,
                error: err
            };
        } else {
            response = {
                success: true
            };
        }
        res.json(response);
    });
}

function routeCategoriesSetVisible(req, res) {
    var visible;
    if(req.body.visible == 1) {
        visible = 1;
    } else {
        visible = 0;
    }
    connectionAPI.query("UPDATE categories SET categories.visible = ? WHERE categories.id = ?", [visible, req.params.categoryId], function(err, result) {
        var response;
        if(err) {
            console.log(err);
            response = {
                success: false,
                error: err
            };
        } else {
            response = {
                success: true
            };
        }
        res.json(response);
    });
}

function routeOrdersGetOpen(req, res) {
    connectionAPI.query("SELECT orders.id, orders.date_created, orders.users_id FROM orders WHERE orders.date_finished IS NULL ORDER BY orders.date_created", [], function(err, result) {
        var response = [];
        if(err) {
            console.log(err);
        } else {
            var ordersId = [];
            result.forEach(function(row) {
                ordersId.push(row.id);

                response.push({
                    id: row.id,
                    date_created: row.date_created,
                    products: [],
                    userId: row.users_id
                });
            });

            connectionAPI.query("SELECT orders_products.products_id, orders_products.amount, orders_products.products_id_sub, orders_products.orders_id FROM orders_products WHERE orders_products.orders_id IN (?)", [ordersId], function (err, result) {
                if(err) {
                    console.log(err);
                } else {
                    result.forEach(function(product) {
                        response.forEach(function(order) {
                            if(order.id == product.orders_id) {
                                order.products.push({
                                    id: product.products_id,
                                    amount: product.amount,
                                    sub: product.products_id_sub
                                });
                            }
                        });
                    });
                    res.json(response);
                }
            });
        }
    });
}

function routeOrdersGetFinished(req, res) {
    connectionAPI.query("SELECT orders.id, orders.date_created, orders.date_finished, orders.users_id FROM orders WHERE orders.date_finished < NOW() ORDER BY orders.date_finished DESC LIMIT 8", [], function(err, result) {
        var response = [];
        if(err) {
            console.log(err);
        } else {
            var ordersId = [];
            result.forEach(function(row) {
                ordersId.push(row.id);

                response.push({
                    id: row.id,
                    date_created: row.date_created,
                    date_finished: row.date_finished,
                    products: [],
                    userId: row.users_id
                });
            });

            connectionAPI.query("SELECT orders_products.products_id, orders_products.amount, orders_products.products_id_sub, orders_products.orders_id FROM orders_products WHERE orders_products.orders_id IN (?)", [ordersId], function (err, result) {
                if(err) {
                    console.log(err);
                } else {
                    result.forEach(function(product) {
                        response.forEach(function(order) {
                            if(order.id == product.orders_id) {
                                order.products.push({
                                    id: product.products_id,
                                    amount: product.amount,
                                    sub: product.products_id_sub
                                });
                            }
                        });
                    });
                    res.json(response);
                }
            });
        }
    });
}

function routeOrdersSetDone(req, res) {
    var done;
    if(req.body.done == 1) {
        done = 1;
    } else {
        done = 0;
    }
    if(done) {
        connectionAPI.query("UPDATE orders SET orders.date_finished = NOW() WHERE orders.id = ?", [req.params.orderId], function(err, result) {
            var response;
            if(err) {
                console.log(err);
                response = {
                    success: false,
                    error: err
                };
            } else {
                response = {
                    success: true
                };
            }
            res.json(response);
        });
    } else {
        connectionAPI.query("UPDATE orders SET orders.date_finished = NULL WHERE orders.id = ?", [req.params.orderId], function(err, result) {
            var response;
            if(err) {
                console.log(err);
                response = {
                    success: false,
                    error: err
                };
            } else {
                response = {
                    success: true
                };
            }
            res.json(response);
        });
    }
}

function routeOrdersCreate(req, res) {
    var response;
    var order = JSON.parse(req.body.order)
    connectionAPI.query("SELECT kiosks.id FROM kiosks WHERE kiosks.uid = ? LIMIT 1", [req.body.uid], function(err, result) {
        if (err) {
            console.log(err);
            response = {
                success: false,
                error: err
            };
            res.json(response);
        } else {
            var userId = order.userId;
            var kioskId = result[0].id;
            var random = makeRandomString();
            connectionAPI.query("INSERT INTO orders SET orders.date_created = NOW(), orders.kiosks_id = ?, orders.random = ?, orders.users_id = ?", [kioskId, random, userId], function(err, result) {
                var response;
                if (err) {
                    console.log(err);
                    response = {
                        success: false,
                        error: err
                    };
                    res.json(response);
                } else {
                    connectionAPI.query("SELECT orders.id FROM orders WHERE random = ?", [random], function(err, result) {
                        if (err) {
                            console.log(err);
                            response = {
                                success: false,
                                error: err
                            };
                            res.json(response);
                        } else {
                            var id = result[0].id;
                            var products = order.products;

                            products.products.forEach(function(product) {
                                connectionAPI.query("SELECT products.price FROM products WHERE products.id = ?", [product.id], function(err, result) {
                                    if (err) {
                                        console.log(err);
                                        response = {
                                            success: false,
                                            error: err
                                        };
                                        res.json(response);
                                    } else {
                                        var price = result[0].price;
                                        connectionAPI.query("INSERT INTO orders_products SET orders_products.orders_id = ?, orders_products.products_id = ?, orders_products.price = ?, orders_products.amount = ?, orders_products.products_id_sub = ?", [id, product.id, price, product.amount, product.sub], function(err, result) {
                                            if (err) {
                                                console.log(err);
                                                response = {
                                                    success: false,
                                                    error: err
                                                };
                                            }
                                        });
                                    }
                                });
                            });
                            response = {
                                success: true,
                                order: id
                            };
                            res.json(response);
                        }
                    });
                }
            });
        }
    });
}

function routeStationsGet(req, res) {
    connectionAPI.query("SELECT stations.id, stations.name, stations.color FROM stations ORDER BY stations.name", [], function(err, result) {
        var response = [];
        if(err) {
            console.log(err);
        } else {
            var stationsId = [];
            result.forEach(function(row) {
                stationsId.push(row.id);

                response.push({
                    id: row.id,
                    name: row.name,
                    color: row.color,
                    products: []
                });
            });

            connectionAPI.query("SELECT stations_products.products_id, stations_products.stations_id FROM stations_products WHERE stations_products.stations_id IN (?)", [stationsId], function (err, result) {
                if(err) {
                    console.log(err);
                } else {
                    result.forEach(function(product) {
                        response.forEach(function(station) {
                            if(station.id == product.stations_id) {
                                station.products.push({
                                    id: product.products_id
                                });
                            }
                        });
                    });
                    res.json(response);
                }
            });
        }
    });
}

function routeUsersGet(req, res) {
    connectionAPI.query("SELECT COUNT(users.id) AS count FROM users WHERE users.barcode = ?", [req.params.barcode], function(err, result) {
        if(err) {
            console.log(err);
        } else {
            var imageBase = "http://www.fom.be/img/";
            var defaultImage = imageBase + "icons/default/defaultavatar.jpg";
            var userData = {
                id: "",
                name: "",
                image: "",
                crew: 0,
                barcode: req.params.barcode
            };
            if(result[0].count == 0) {
                connectionFom.query("SELECT barcodes.crewId, barcodes.memberId, barcodes.visitorId FROM barcodes WHERE barcodes.barcodeNr = ?", [req.params.barcode], function(err, result) {
                    if(err) {
                        console.log(err);
                    } else {
                        if(result[0].crewId != null) {
                            connectionFom.query("SELECT users.id, users.nickname, users.imageUrl FROM users WHERE users.id = ?", [result[0].crewId], function(err, result) {
                                if(err) {
                                    console.log(err);
                                } else {
                                    userData.id = "1"+result[0].id;
                                    userData.name = result[0].nickname;
                                    if(result[0].imageUrl.length > 0) {
                                        userData.image = imageBase + result[0].imageUrl;
                                    } else {
                                        userData.image = defaultImage;
                                    }
                                    userData.crew = 1;
                                    setUserData(userData);
                                    res.json(userData);
                                }
                            });
                        }
                        if(result[0].memberId != null) {
                            connectionFom.query("SELECT users.id, users.nickname, users.imageUrl FROM users WHERE users.id = ?", [result[0].memberId], function(err, result) {
                                if(err) {
                                    console.log(err);
                                } else {
                                    userData.id = "2"+result[0].id;
                                    userData.name = result[0].nickname;
                                    if(result[0].imageUrl.length > 0) {
                                        userData.image = imageBase + result[0].imageUrl;
                                    } else {
                                        userData.image = defaultImage;
                                    }
                                    setUserData(userData);
                                    res.json(userData);
                                }
                            });
                        }
                        if(result[0].visitorId != null) {
                            connectionFom.query("SELECT visitors.id, visitors.firstname, visitors.lastname FROM visitors WHERE visitors.id = ?", [result[0].memberId], function(err, result) {
                                if(err) {
                                    console.log(err);
                                } else {
                                    userData.id = "3"+result[0].id;
                                    userData.name = result[0].nickname;
                                    userData.image = defaultImage;
                                    setUserData(userData);
                                    res.json(userData);
                                }
                            });
                        }
                    }
                });
            } else {
                connectionAPI.query("SELECT users.id, users.name, users.image, users.crew FROM users WHERE users.barcode = ?", [req.params.barcode], function(err, result) {
                    if(err) {
                        console.log(err);
                    } else {
                        userData.id = result[0].id;
                        userData.name = result[0].name;
                        userData.image = result[0].image;
                        userData.crew = result[0].crew;
                        res.json(userData);
                    }
                });
            }
        }
    });
}

function setUserData(userdata) {
    connectionAPI.query("INSERT INTO users SET users.id = ?, users.name = ?, users.image = ?, users.crew = ?, users.barcode = ?", [userdata.id, userdata.name, userdata.image, userdata.crew, userdata.barcode]);
}