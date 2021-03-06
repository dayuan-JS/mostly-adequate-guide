console.log('monad～')

//pointed functor
//关于之前functor上的of方法 其实不是用来避免使用new关键字的 
//而是用来将值放到默认最小化上下文中的

function curry(fn, len = fn.length) {
  return (function curried(lastArgs) {
    return function (...prevArgs) {
      let args = [...lastArgs, ...prevArgs]
      if (args.length >= len) {
        return fn(...args)
      }
      return curried(args)
    }
  })([])
}

function unboundMethod(methodName, len) {
  return curry(function (...args) {
    args.length = len;
    let obj = args.pop();
    return obj[methodName](...args)
  }, len)
}

let concat = unboundMethod('concat', 2)
let map = unboundMethod('map', 2)
let reduce = unboundMethod('reduce', 3)

function compose(...fns) {
  let [fn1, fn2, ...rest] = fns.reverse()

  let composed = function (...args) {
    return fn2(fn1(...args))
  }

  if (!rest.length) {
    return composed
  }
  return compose(...rest.reverse(), composed)
}

function _add(a, b) {
  return a + b
}
let add = curry(_add)

function _test(x, v) {
  console.log(x, v)
  return v
}
let test = curry(_test)

function _prop(label, obj) {
  return obj[label]
}
let prop = curry(_prop)

//关键点是把任意值丢到容器里 然后到处使用map的能力

// IO Test
function IO(value) {
  this.unsafePerformIO = value
}

IO.of = function (x) {
  return new IO(function () {
    return x
  })
}

IO.prototype.map = function (f) {
  return new IO(compose(f, this.unsafePerformIO))
}

let io_test = IO.of('hello ').map(concat('world'))
console.log(io_test.unsafePerformIO(), 'io_test')

//Maybe Test
function Maybe(x) {
  this._value = x
}

Maybe.of = function (x) {
  return new Maybe(x)
}

Maybe.prototype.isNothing = function () {
  return this._value === undefined || this._value === null
}

Maybe.prototype.map = function (f) {
  return this.isNothing() ? Maybe.of(null) : Maybe.of(f(this._value))
}

console.log(Maybe.of(123).map(add(1)), 'maybe_test')

//Either Test
function Either(x) {
  this._value = x
}

Either.of = function (x, f = isNothing) {
  return f(x) ? Left.of(x) : Right.of(x)
}

function isNothing(x) {
  return x === undefined || x === null
}


function Left(x) {
  this._value = x
}

Left.of = function (x) {
  return new Left(x)
}

Left.prototype.map = function () {
  return this
}

function Right(x) {
  this._value = x
}

Right.of = function (x) {
  return new Right(x)
}

Right.prototype.map = function (f) {
  return Right.of(f(this._value))
}

console.log(Either.of('not data').map(concat('123')), 'either_test')

/**
 * IO的构造器接受一个函数作为参数 Maybe和Either可以接受任意类型
 * 实现这种接口的动机是 我们希望能有一种通用的、一致的方式往functor里面填值
 * 
 * (pure point unit return) of 史上最神秘的函数
 * of将在开始使用monad时十分重要 因为到后面 手动把值放回容器是我们自己的责任
 */

// Support
// ===========================

//  readFile :: String -> IO String
var readFile = function (filename) {
  return new IO(function () {
    return filename
  });
};

//  print :: String -> IO String
var print = function (x) {
  return new IO(function () {
    return x;
  });
}

// Example
// ===========================
//  cat :: IO (IO String)
var cat = compose(map(print), readFile);

console.log(cat(".git/config").unsafePerformIO().unsafePerformIO(), 'io')
// IO(IO("[core]\nrepositoryformatversion = 0\n"))

//包了一层IO 显得怪怪的


//另一个例子

//正常的无嵌套
let normalMaybe = compose(map(prop('street')), map(prop(0)), map(prop('addresses')), Maybe.of)
console.log(normalMaybe(
  { addresses: [{ street: { name: 'Mulburry', number: 8402 }, postcode: "WC2N" }] }
), 'functor_maybe')

//monad
//  safeProp :: Key -> {Key: a} -> Maybe a
var safeProp = curry(function (x, obj) {
  return new Maybe(obj[x]);
});

//  safeHead :: [a] -> Maybe a
var safeHead = safeProp(0);

//  firstAddressStreet :: User -> Maybe (Maybe (Maybe Street) )
var firstAddressStreet = compose(
  map(map(safeProp('street'))), map(safeHead), safeProp('addresses')
);

console.log(firstAddressStreet(
  { addresses: [{ street: { name: 'Mulburry', number: 8402 }, postcode: "WC2N" }] }
), 'monad')
// Maybe(Maybe(Maybe({name: 'Mulburry', number: 8402})))

//这里的functor同样也是嵌套的 三个可能失败的地方都用了maybe
//嵌套的functor是monad的主要使用场景！！
//monad像洋葱 当我们用map剥开嵌套的functor获取里面的值时 就像剥洋葱一样让人忍不住想哭
//幸好我们有join

Maybe.prototype.join = function () {
  return this.isNothing() ? Maybe.of(null) : this._value
}

IO.prototype.join = function () {
  return this.unsafePerformIO()
}

let mmo = Maybe.of(Maybe.of('nun_chucks'))
console.log(mmo)
console.log(mmo.join(), 'join_maybe')

let ioio = IO.of(IO.of('hello world'))
console.log(ioio.unsafePerformIO().unsafePerformIO())
console.log(ioio.join().unsafePerformIO(), 'join_io')

//如果有两层相同的嵌套 就可以用join把他们压扁到一块去
//这种结合的能力 functor之间的联姻 就是monad之所以成为monad的原因

/**
 * monad是可以变扁（flatten）的pointed functor
 * 一个functor只要他有join和of方法 并遵循一些定律 那么他就是一个monad
 */

//把monad魔法作用到firstAddressStreet上

//Monad m => m(m a) -> m a
let join = function (mma) { return mma.join() }

let firstAddressStreet2 = compose(
  join, map(safeProp('street')), join, map(safeHead), safeProp('addresses')
)
console.log(firstAddressStreet2(
  { addresses: [{ street: { name: 'Mulburry', number: 8402 }, postcode: "WC2N" }] }
), 'monad_join')
//只要遇到嵌套的Maybe 就是用join 然后是IO

// log :: x -> IO x
let log = function (x) {
  return new IO(function () {
    console.log(`log:`, x)
    return x
  })
}

//setStyle :: sel -> str -> IO DOM
let setStyle = curry(
  function (sel, props) {
    return new IO(function () {
      return document.getElementsByTagName(sel)[0].setAttribute('class', props)
    })
  }
)

// getItem :: str -> IO str
let getItem = function (key) {
  return new IO(function () {
    return localStorage.getItem(key)
  })
}

//  applyPreferences :: String -> IO DOM
let applyPreferences = compose(
  join, map(setStyle('body')), join, map(log), map(JSON.parse), getItem
);

applyPreferences('user').unsafePerformIO()

//chain 函数

/**
 * 从上面的例子中可以看出 总是在map后面调用join 可以把这个行为抽象到chain函数里面
 * 
 */
//chain ::  Monad m => (a -> m b) -> m a -> m b
let chain = curry(
  function (f, m) {
    return compose(join, map(f))(m)
  }
)
//这里仅仅是将map/join打包到一个单独函数中
//如果之前了解过monad chain也叫做 >>= (读作bind) 或者flatMap

// 使用chain重构上面两个例子

let firstAddressStreet3 = compose(
  chain(safeProp('street')), chain(safeHead), safeProp('addresses')
)
console.log(firstAddressStreet3(
  { addresses: [{ street: { name: 'Mulburry', number: 8402 }, postcode: "WC2N" }] }
), 'monad_chain')

let applyPreferences2 = compose(
  chain(setStyle('body')), chain(log), map(JSON.parse), getItem
);
applyPreferences2('user').unsafePerformIO()

//把所有的map/join全部替换成了chain 显得整洁了一些
//chain还可以轻松嵌套多个作用
//因此我们就能以一种纯函数式的方式来表示序列和变量赋值

IO.prototype.chain = function (f) {
  return this.map(f).join()
}

function querySelector(sel) {
  return new IO(function () {
    return {
      value: `${sel}------test`
    }
  })
}

// querySelector :: Selector -> IO DOM
let IONestedChainTest = querySelector("input.username").chain(
  function (uname) {
    return querySelector("input.email").chain(function (email) {
      return IO.of(
        "Welcome " + uname.value + " " + "prepare for spam at " + email.value
      );
    });
  }
);

console.log(IONestedChainTest.unsafePerformIO(), 'IONestedChainTest')

//  maybe
Maybe.prototype.chain = function (f) {
  return this.map(f).join()
}

let MaybeNestedChainTest = Maybe.of(3).chain(function (three) {
  return Maybe.of(2).map(add(three))
})

console.log(MaybeNestedChainTest, 'MaybeNestedChainTest')

Maybe.of(null).chain(safeProp('address')).chain(safeProp('street'));
// Maybe(null);

/**
 * querySelector 在最内层访问uname和email 这是函数式变量赋值的绝佳表现
 * 因为IO把值借给了我们 我们也要以同样方式把值放回原处
 * IO.of非常适合做这件事 同时也解释了pointed这一特性是monad接口存在的重要前提
 * 不过map也能返回重要的类型
 */

let IONestedChainTest2 = querySelector("input-user").chain(function (user) {
  return querySelector('email-map').map(function (email) {
    return "Welcome " + user.value + " " + "prepare for spam at " + email.value
  })
})
console.log(IONestedChainTest2.unsafePerformIO(), 'IONestedChainTest2')
//如果返回的是‘普通’值就用map 返回的是functor就用chain

// Maybe自我练习

let data = {
  data: [1, 2, 3, 4, 5]
}

let maybe = curry(
  function (x, f, m) {
    return m.isNothing() ? x : f(m._value)
  }
)

let splice = unboundMethod('splice', 3)

let deleteData = compose(maybe([], splice(0, 1)), map(prop('data')), Maybe.of)

console.log(deleteData(data))

// IO自我练习
function createDom(ele) {
  return new IO(function () {
    let e = document.createElement(ele)
    return e
  })
}

let changeInner = curry(function (txt, ele) {
  return new IO(function () {
    ele.innerText = txt
    return ele
  })
})

function appendDom(dom) {
  return new IO(function () {
    return document.body.appendChild(dom)
  })
}

let createElement = compose(
  chain(appendDom),
  chain(changeInner('hello monad')),
  createDom
)

createElement('div').unsafePerformIO()

//理论

/**
 * 结合律 (但不是我们所熟悉的那个结合律)
 * compose(join,map(join))==compose(join,join)
 *
 * 这些定律表明了monad嵌套的本质
 * 所以结合律关心的是如何让内层或外层的容器类型join
 * 然后取得同样的结果
 *
 *               map(join)
 * M(M(a))          ->          M(a)
 *
 *
 *
 *   | join                      | join
 *   v                           v
 *
 *                join
 *  M(a)            ->           a
 *
 */

/**
 * 同一律
 * compose(join,map(of))==compose(join,of)==id
 * 对任意的monad M  of和join 等同于id 也可以使用map(of)
 * 我们把这个定律叫做三角同一律
 * img -> static -> image ->三角同一律
 * 
 */

var mcompose = function (f, g) {
  return compose(chain(f), chain(g));
}

// 左同一律
// mcompose(M, f) == f

// 右同一律
// mcompose(f, M) == f

// 结合律
// mcompose(mcompose(f, g), h) == mcompose(f, mcompose(g, h))

/**
 * 总结
 * monad让我们深入到嵌套的计算当中 在完全避免回调金字塔的情况下 为变量进行赋值 运行有序的作用 等
 * 当一个值被困在几层相同的容器中时 monad能拯救他 借助‘pointed’这个可靠的助手
 * monad能够借给我们从盒子取出的值 而且知道哦们会在结束使用后还给他们
 *
 */

//练习
// 练习 1
// ==========
// 给定一个 user，使用 safeProp 和 map/join 或 chain 安全地获取 street 的 name

var safePropT = _.curry(function (x, o) { return Maybe.of(o[x]); });
var userT = {
  id: 2,
  name: "albert",
  address: {
    street: {
      number: 22,
      name: 'Walnut St'
    }
  }
};

var ex1 = compose(chain(safePropT('name')), chain(safePropT('street')), safePropT('address'))
console.log(ex1(userT), '练习1')

// 练习 2
// ==========
// 使用 getFile 获取文件名并删除目录，所以返回值仅仅是文件，然后以纯的方式打印文件

var getFile = function () {
  return new IO(function () { return __filename; });
}

var pureLog = function (x) {
  return new IO(function () {
    console.log(x);
    return 'logged ' + x;
  });
}

var ex2 = compose(chain(pureLog), getFile);
let ex2T = ex2().unsafePerformIO()
console.log(ex2T, '练习2')

// 练习 3
// ==========
// 使用 getPost() 然后以 post 的 id 调用 getComments()
// var getPost = function (i) {
//   return new Task(function (rej, res) {
//     setTimeout(function () {
//       res({ id: i, title: 'Love them tasks' });
//     }, 300);
//   });
// }

// var getComments = function (i) {
//   return new Task(function (rej, res) {
//     setTimeout(function () {
//       res([
//         { post_id: i, body: "This book should be illegal" },
//         { post_id: i, body: "Monads are like smelly shallots" }
//       ]);
//     }, 300);
//   });
// }
// var ex3 = _.compose(chain(_.compose(getComments, _.prop('id'))), getPost);

// 练习 4
// ==========
// 用 validateEmail、addToMailingList 和 emailBlast 实现 ex4 的类型签名

//  addToMailingList :: Email -> IO([Email])
// var addToMailingList = (function (list) {
//   return function (email) {
//     return new IO(function () {
//       list.push(email);
//       return list;
//     });
//   }
// })([]);

// function emailBlast(list) {
//   return new IO(function () {
//     return 'emailed: ' + list.join(',');
//   });
// }

// var validateEmail = function (x) {
//   return x.match(/\S+@\S+\.\S+/) ? (new Right(x)) : (new Left('invalid email'));
// }

// //  ex4 :: Email -> Either String (IO String)
// var ex4 = _.compose(_.map(_.compose(chain(emailBlast), addToMailingList)), validateEmail);