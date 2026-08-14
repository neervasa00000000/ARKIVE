const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ARKIVE — Full Test Suite", function () {
  let points, linker, users, posts, vault;
  let owner, primary, secondary, tertiary, stranger;

  beforeEach(async function () {
    [owner, primary, secondary, tertiary, stranger] = await ethers.getSigners();

    const Points = await ethers.getContractFactory("PointsSystem");
    points = await Points.deploy();

    const Linker = await ethers.getContractFactory("WalletLinker");
    linker = await Linker.deploy();

    const Users = await ethers.getContractFactory("UserRegistry");
    users = await Users.deploy();
    await users.setWalletLinker(await linker.getAddress());

    const Posts = await ethers.getContractFactory("PostRegistry");
    posts = await Posts.deploy(await points.getAddress(), await linker.getAddress());

    const Vault = await ethers.getContractFactory("VaultRegistry");
    vault = await Vault.deploy(await linker.getAddress());

    await points.setWalletLinker(await linker.getAddress());
    await points.authoriseCaller(await posts.getAddress());
  });

  describe("WalletLinker", function () {
    it("secondary requests link, primary confirms", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      const linked = await linker.getLinkedWallets(primary.address);
      expect(linked[0]).to.equal(secondary.address);
      expect(await linker.getPrimary(secondary.address)).to.equal(primary.address);
      expect(await linker.areSameIdentity(primary.address, secondary.address)).to.be.true;
    });

    it("cannot link without both signing", async function () {
      await expect(
        linker.connect(primary).confirmLink(secondary.address),
      ).to.be.revertedWith("No pending request from this wallet to you");
    });

    it("enforces max 3 wallets per identity", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);
      await linker.connect(tertiary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(tertiary.address);

      const [, , , , fourth] = await ethers.getSigners();
      await expect(
        linker.connect(fourth).requestLink(primary.address),
      ).to.be.revertedWith("Primary wallet already has maximum linked wallets");
    });

    it("either party can unlink", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await linker.connect(secondary).unlinkWallet(secondary.address);
      expect(await linker.getPrimary(secondary.address)).to.equal(secondary.address);
    });
  });

  describe("UserRegistry", function () {
    it("registers primary wallet", async function () {
      await users.connect(primary).register("goose");
      const user = await users.getUser(primary.address);
      expect(user.username).to.equal("goose");
    });

    it("secondary wallet shares primary identity", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await users.connect(primary).register("goose");
      const userViaSec = await users.getUser(secondary.address);
      expect(userViaSec.username).to.equal("goose");
    });

    it("blocks duplicate usernames", async function () {
      await users.connect(primary).register("goose");
      await expect(users.connect(stranger).register("goose")).to.be.revertedWith("Username taken");
    });

    it("rejects invalid usernames", async function () {
      await expect(users.connect(primary).register("Bad")).to.be.revertedWith("Invalid username");
    });
  });

  describe("PointsSystem", function () {
    it("welcome bonus awarded to primary", async function () {
      await points.connect(primary).claimWelcomeBonus();
      expect(await points.getPoints(primary.address)).to.equal(225);
    });

    it("linked wallet earns points for primary", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await points.connect(owner).awardPoints(secondary.address, 50, "test");
      expect(await points.getPoints(primary.address)).to.equal(50);
    });
  });

  describe("PostRegistry", function () {
    it("post attributed to primary wallet", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await posts.connect(secondary).createPost("ar123", "text");
      const post = await posts.getPost(0);
      expect(post.author).to.equal(primary.address);
    });

    it("linked wallets cannot like same post twice", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await posts.connect(stranger).createPost("ar123", "text");
      await posts.connect(primary).likePost(0);

      await expect(posts.connect(secondary).likePost(0)).to.be.revertedWith("Already liked");
    });
  });

  describe("VaultRegistry", function () {
    it("file accessible by any linked wallet", async function () {
      await linker.connect(secondary).requestLink(primary.address);
      await linker.connect(primary).confirmLink(secondary.address);

      await vault.connect(primary).storeFile("enc123", "secret.jpg", "image", "hash");

      const filesViaSecondary = await vault.connect(secondary).getMyFiles();
      expect(filesViaSecondary.length).to.equal(1);
      expect(filesViaSecondary[0].fileName).to.equal("secret.jpg");
    });

    it("stranger cannot see private files", async function () {
      await vault.connect(primary).storeFile("enc123", "secret.jpg", "image", "hash");
      const strangerFiles = await vault.connect(stranger).getMyFiles();
      expect(strangerFiles.length).to.equal(0);
    });

    it("rejects duplicate arweave id globally", async function () {
      await vault.connect(primary).storeFile("enc-dup", "a.jpg", "image", "hash");
      await expect(
        vault.connect(stranger).storeFile("enc-dup", "b.jpg", "image", "hash"),
      ).to.be.revertedWith("Arweave ID already stored");
    });

    it("locks wallet linker after config lock", async function () {
      await vault.lockConfig();
      await expect(vault.setWalletLinker(stranger.address)).to.be.revertedWith("Config locked");
    });
  });

  describe("SecureConfig", function () {
    it("two-step ownership transfer", async function () {
      await points.transferOwnership(stranger.address);
      await expect(points.connect(stranger).acceptOwnership()).to.not.be.reverted;
      expect(await points.owner()).to.equal(stranger.address);
    });
  });
});
