"use strict"
var config      = require("../config.json");
var mysql       = require("mysql");
var express     = require("express");
var app         = express();
var server      = require("http").createServer(app);
var bodyParser  = require('body-parser');
//var io      = require("socket.io")(server);


server.listen(config.port);

app.set("case sensitive routing", true);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// =====START=====
//      MySQL
// =====START=====
var connection = mysql.createConnection({
    host:       config.host,
    user:       config.user,
    password:   config.pass,
    database:   "kassakiosk"
});
connection.connect();
// ======END======
//      MySQL
// ======END======

/*io.on('connection', function(socket) {

});*/

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    next();
});

app.post("*", function(req, res, next) {
    var response;
    if(typeof req.body.uid !== undefined && typeof req.body.secret !== undefined) {
        connection.query("SELECT kiosks.secret FROM kiosks WHERE kiosks.uid = ? LIMIT 1", [req.body.uid], function(err, result) {
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


});

app.post("/check",  function(req, res) {
    res.json({
        success: true
    });
});

app.post("/products/get", function(req, res) {
    connection.query("SELECT categories.id, categories.name, categories.visible, categories.sort FROM categories ORDER BY categories.sort", [], function(err, result) {
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

            connection.query("SELECT products.id, products.name, products.price, products.visible, products.sort, products.categories_id, products.categories_id_sub FROM products WHERE products.categories_id IN (?) ORDER BY products.sort", [categoriesId], function (err, result) {
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
});

app.post("/products/set/:productId([0-9]+)/visible", function(req, res) {
    var visible;
    if(req.body.visible == 1) {
        visible = 1;
    } else {
        visible = 0;
    }
    connection.query("UPDATE products SET products.visible = ? WHERE products.id = ?", [visible, req.params.productId], function(err, result) {
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
});

app.post("/categories/set/:categoryId([0-9]+)/visible", function(req, res) {
    var visible;
    if(req.body.visible == 1) {
        visible = 1;
    } else {
        visible = 0;
    }
    connection.query("UPDATE categories SET categories.visible = ? WHERE categories.id = ?", [visible, req.params.categoryId], function(err, result) {
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
});

app.post("/orders/get/open", function(req, res) {
    connection.query("SELECT orders.id, orders.date_created FROM orders WHERE orders.date_finished IS NULL ORDER BY orders.date_created", [], function(err, result) {
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
                    products: []
                });
            });

            connection.query("SELECT orders_products.products_id, orders_products.amount, orders_products.products_id_sub, orders_products.orders_id FROM orders_products WHERE orders_products.orders_id IN (?)", [ordersId], function (err, result) {
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
});

app.post("/orders/get/finished", function(req, res) {
    connection.query("SELECT orders.id, orders.date_created, orders.date_finished FROM orders WHERE orders.date_finished < NOW() ORDER BY orders.date_finished DESC LIMIT 8", [], function(err, result) {
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
                    products: []
                });
            });

            connection.query("SELECT orders_products.products_id, orders_products.amount, orders_products.products_id_sub, orders_products.orders_id FROM orders_products WHERE orders_products.orders_id IN (?)", [ordersId], function (err, result) {
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
});

app.post("/orders/set/:orderId([0-9]+)/done", function(req, res) {
    var done;
    if(req.body.done == 1) {
        done = 1;
    } else {
        done = 0;
    }
    if(done) {
        connection.query("UPDATE orders SET orders.date_finished = NOW() WHERE orders.id = ?", [req.params.orderId], function(err, result) {
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
        connection.query("UPDATE orders SET orders.date_finished = NULL WHERE orders.id = ?", [req.params.orderId], function(err, result) {
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
});

app.post("/orders/create", function(req, res) {
    var response;
    connection.query("SELECT kiosks.id FROM kiosks WHERE kiosks.uid = ? LIMIT 1", [req.body.uid], function(err, result) {
        if (err) {
            console.log(err);
            response = {
                success: false,
                error: err
            };
            res.json(response);
        } else {
            var kioskId = result[0].id;
            var random = makeRandomString();
            connection.query("INSERT INTO orders SET orders.date_created = NOW(), orders.kiosks_id = ?, orders.random = ?", [kioskId, random], function(err, result) {
                var response;
                if (err) {
                    console.log(err);
                    response = {
                        success: false,
                        error: err
                    };
                    res.json(response);
                } else {
                    connection.query("SELECT orders.id FROM orders WHERE random = ?", [random], function(err, result) {
                        if (err) {
                            console.log(err);
                            response = {
                                success: false,
                                error: err
                            };
                            res.json(response);
                        } else {
                            var id = result[0].id;
                            var products = JSON.parse(req.body.products);

                            products.products.forEach(function(product) {
                                connection.query("SELECT products.price FROM products WHERE products.id = ?", [product.id], function(err, result) {
                                    if (err) {
                                        console.log(err);
                                        response = {
                                            success: false,
                                            error: err
                                        };
                                        res.json(response);
                                    } else {
                                        var price = result[0].price;
                                        connection.query("INSERT INTO orders_products SET orders_products.orders_id = ?, orders_products.products_id = ?, orders_products.price = ?, orders_products.amount = ?, orders_products.products_id_sub = ?", [id, product.id, price, product.amount, product.sub], function(err, result) {
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
});

app.post("/stations/get", function(req, res) {
    connection.query("SELECT stations.id, stations.name, stations.color FROM stations ORDER BY stations.name", [], function(err, result) {
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

            connection.query("SELECT stations_products.products_id, stations_products.stations_id FROM stations_products WHERE stations_products.stations_id IN (?)", [stationsId], function (err, result) {
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
});

app.use(function (req, res) {
    res.status(404).end("404 Page is choud!");
});

function makeRandomString() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 16; i++ ) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}