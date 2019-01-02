const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");
const { hasPermission } = require("../utils");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      throw new Error("You must be logged in to do that!");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          user: {
            connect: {
              id: ctx.request.userId
            }
          },
          ...args
        }
      },
      info
    );

    return item;
  },
  updateItem(parent, args, ctx, info) {
    // first take a copy of the updates
    const updates = { ...args };
    // remove ID form the updates
    delete updates.id;
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id
        }
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    // check if they are lgoged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in!");
    }

    const where = { id: args.id };
    // find the item
    const item = await ctx.db.query.item({ where }, `{ id title user { id } }`);
    // check if they own that item or have permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ["ADMIN", "ITEMDELETE"].includes(permission)
    );
    if (!ownsItem && !hasPermissions) {
      throw new Error("You don't have permission to do this.");
    }
    // delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signup(parent, args, ctx, info) {
    // lowercase their email
    args.email = args.email.toLowerCase();
    // hash their password
    const password = await bcrypt.hash(args.password, 10);
    // create the user
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );
    // create JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set cookie on response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    // return user to the browser
    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    // check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No account for ${email} found.`);
    }
    // check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid password.");
    }
    // generate the jwt token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // return the user
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },
  async requestReset(parent, args, ctx, info) {
    // check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email } });
    if (!user) {
      throw new Error(`No user found for ${email}`);
    }

    // set a reset token and expiry on that user
    const randomBytesPromised = promisify(randomBytes);
    const resetToken = (await randomBytesPromised(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    const res = ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    });
    // email them that reset token
    const mailRes = await transport.sendMail({
      from: "support@sickfits.com",
      to: user.email,
      subject: "Your password reset token",
      html: makeANiceEmail(`Your Password Reset Token is here!
      \n\n
      <a 
      href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">
      Click here to Reset</a>
      `)
    });

    // return a message
    return { message: "Thanks!" };
  },
  async resetPassword(
    parent,
    { password, confirmPassword, resetToken },
    ctx,
    info
  ) {
    // check if the passwords match
    if (password !== confirmPassword) {
      throw new Error("New passwords do not match");
    }
    // check if its a legit reset token
    const [tokenUser] = await ctx.db.query.users({ where: { resetToken } });
    if (!tokenUser) {
      throw new Error("Invalid reset token.");
    }
    // check if it's expired
    if (Date.now() > tokenUser.resetTokenExpiry) {
      throw new Error("Token has expired :(");
    }

    // hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // save new password and remove old resetToken fields
    const saveUser = await ctx.db.mutation.updateUser({
      where: { id: tokenUser.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    // generate the jwt token
    const token = jwt.sign({ userId: saveUser.id }, process.env.APP_SECRET);
    // set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // return the user
    return saveUser;
  },
  async updatePermissions(parent, args, ctx, info) {
    // check if they are lgoged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in!");
    }
    // query current user
    const currentUser = await ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId
        }
      },
      info
    );
    console.log("hello", currentUser);
    // check if they have permission
    hasPermission(currentUser, ["ADMIN", "PERMISSIONUPDATE"]);
    // update permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  },
  async addToCart(parent, args, ctx, info) {
    // Make sure they are signed in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("You must be logged in!");
    }
    // Query the users current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id }
      }
    });
    // Check if that item is already in their cart and increment by 1
    if (existingCartItem) {
      console.log("Item is already in their cart!");
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + 1 }
        },
        info
      );
    }
    // if it isn't, create a fresh CartItem for that user.
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId }
          },
          item: {
            connect: { id: args.id }
          }
        }
      },
      info
    );
  }
};

module.exports = Mutations;
