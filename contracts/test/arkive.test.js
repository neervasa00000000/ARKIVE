const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ARKIVE Contracts", function () {
  let pointsSystem, userRegistry, postRegistry, vaultRegistry;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const PointsSystem = await ethers.getContractFactory("PointsSystem");
    pointsSystem = await PointsSystem.deploy();

    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();

    const PostRegistry = await ethers.getContractFactory("PostRegistry");
    postRegistry = await PostRegistry.deploy(await pointsSystem.getAddress());

    const VaultRegistry = await ethers.getContractFactory("VaultRegistry");
    vaultRegistry = await VaultRegistry.deploy();

    await pointsSystem.authoriseCaller(await postRegistry.getAddress());
  });

  describe("UserRegistry", function () {
    it("registers a user", async function () {
      await userRegistry.connect(user1).register("testuser");
      const user = await userRegistry.getUser(user1.address);
      expect(user.username).to.equal("testuser");
      expect(user.exists).to.be.true;
    });

    it("prevents duplicate usernames", async function () {
      await userRegistry.connect(user1).register("taken");
      await expect(userRegistry.connect(user2).register("taken")).to.be.revertedWith("Username taken");
    });
  });

  describe("PointsSystem", function () {
    it("awards welcome bonus", async function () {
      await pointsSystem.connect(user1).claimWelcomeBonus();
      expect(await pointsSystem.getPoints(user1.address)).to.equal(225);
    });

    it("prevents double claiming", async function () {
      await pointsSystem.connect(user1).claimWelcomeBonus();
      await expect(pointsSystem.connect(user1).claimWelcomeBonus()).to.be.revertedWith("Already claimed");
    });
  });

  describe("PostRegistry", function () {
    it("creates a post and awards points", async function () {
      await postRegistry.connect(user1).createPost("arweave123", "text");
      const post = await postRegistry.getPost(0);
      expect(post.arweaveId).to.equal("arweave123");
      expect(post.author).to.equal(user1.address);
    });

    it("allows liking a post", async function () {
      await postRegistry.connect(user1).createPost("arweave123", "text");
      await postRegistry.connect(user2).likePost(0);
      const post = await postRegistry.getPost(0);
      expect(post.likes).to.equal(1);
    });

    it("prevents liking own post", async function () {
      await postRegistry.connect(user1).createPost("arweave123", "text");
      await expect(postRegistry.connect(user1).likePost(0)).to.be.revertedWith("Cannot like own post");
    });
  });

  describe("VaultRegistry", function () {
    it("stores a file and retrieves it", async function () {
      await vaultRegistry.connect(user1).storeFile(
        "encryptedArweaveId123",
        "photo.jpg",
        "image",
        "conditionsHash"
      );
      const files = await vaultRegistry.connect(user1).getMyFiles();
      expect(files.length).to.equal(1);
      expect(files[0].fileName).to.equal("photo.jpg");
    });

    it("prevents other wallets seeing your files", async function () {
      await vaultRegistry.connect(user1).storeFile("enc123", "secret.jpg", "image", "hash");
      const files = await vaultRegistry.connect(user2).getMyFiles();
      expect(files.length).to.equal(0);
    });
  });
});
