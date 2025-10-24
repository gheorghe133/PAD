const { AsyncLocalStorage } = require("async_hooks");
const logger = require("../../utils/logger");

class ThreadSafeStorage {
  constructor() {
    this.data = new Map();
    this.locks = new Map();
    this.asyncLocalStorage = new AsyncLocalStorage();
    this.readWriteLock = {
      readers: 0,
      writers: 0,
      writeQueue: [],
      readQueue: [],
    };
  }

  async acquireReadLock() {
    return new Promise((resolve) => {
      if (
        this.readWriteLock.writers === 0 &&
        this.readWriteLock.writeQueue.length === 0
      ) {
        this.readWriteLock.readers++;
        resolve();
      } else {
        this.readWriteLock.readQueue.push(resolve);
      }
    });
  }

  releaseReadLock() {
    this.readWriteLock.readers--;
    this.processQueue();
  }

  async acquireWriteLock() {
    return new Promise((resolve) => {
      if (
        this.readWriteLock.readers === 0 &&
        this.readWriteLock.writers === 0
      ) {
        this.readWriteLock.writers++;
        resolve();
      } else {
        this.readWriteLock.writeQueue.push(resolve);
      }
    });
  }

  releaseWriteLock() {
    this.readWriteLock.writers--;
    this.processQueue();
  }

  processQueue() {
    if (
      this.readWriteLock.writeQueue.length > 0 &&
      this.readWriteLock.readers === 0 &&
      this.readWriteLock.writers === 0
    ) {
      const writeResolve = this.readWriteLock.writeQueue.shift();
      this.readWriteLock.writers++;
      writeResolve();
      return;
    }

    if (
      this.readWriteLock.readQueue.length > 0 &&
      this.readWriteLock.writers === 0 &&
      this.readWriteLock.writeQueue.length === 0
    ) {
      while (this.readWriteLock.readQueue.length > 0) {
        const readResolve = this.readWriteLock.readQueue.shift();
        this.readWriteLock.readers++;
        readResolve();
      }
    }
  }

  async get(key) {
    await this.acquireReadLock();
    try {
      const value = this.data.get(key);
      logger.debug("Storage read operation", {
        key,
        found: value !== undefined,
      });
      return value;
    } finally {
      this.releaseReadLock();
    }
  }

  async set(key, value) {
    await this.acquireWriteLock();
    try {
      this.data.set(key, value);
      logger.debug("Storage write operation", { key, size: this.data.size });
    } finally {
      this.releaseWriteLock();
    }
  }

  async delete(key) {
    await this.acquireWriteLock();
    try {
      const existed = this.data.has(key);
      const result = this.data.delete(key);
      logger.debug("Storage delete operation", {
        key,
        existed,
        size: this.data.size,
      });
      return result;
    } finally {
      this.releaseWriteLock();
    }
  }

  async has(key) {
    await this.acquireReadLock();
    try {
      const exists = this.data.has(key);
      logger.debug("Storage exists check", { key, exists });
      return exists;
    } finally {
      this.releaseReadLock();
    }
  }

  async keys() {
    await this.acquireReadLock();
    try {
      const keys = Array.from(this.data.keys());
      logger.debug("Storage keys operation", { count: keys.length });
      return keys;
    } finally {
      this.releaseReadLock();
    }
  }

  async values() {
    await this.acquireReadLock();
    try {
      const values = Array.from(this.data.values());
      logger.debug("Storage values operation", { count: values.length });
      return values;
    } finally {
      this.releaseReadLock();
    }
  }

  async entries() {
    await this.acquireReadLock();
    try {
      const entries = Array.from(this.data.entries());
      logger.debug("Storage entries operation", { count: entries.length });
      return entries;
    } finally {
      this.releaseReadLock();
    }
  }

  async clear() {
    await this.acquireWriteLock();
    try {
      const previousSize = this.data.size;
      this.data.clear();
      logger.debug("Storage clear operation", { previousSize });
    } finally {
      this.releaseWriteLock();
    }
  }

  async size() {
    await this.acquireReadLock();
    try {
      const size = this.data.size;
      logger.debug("Storage size operation", { size });
      return size;
    } finally {
      this.releaseReadLock();
    }
  }

  async find(predicate) {
    await this.acquireReadLock();
    try {
      const results = [];
      for (const [key, value] of this.data.entries()) {
        if (predicate(value, key)) {
          results.push(value);
        }
      }
      logger.debug("Storage find operation", { resultCount: results.length });
      return results;
    } finally {
      this.releaseReadLock();
    }
  }

  async paginate(offset = 0, limit = 10) {
    await this.acquireReadLock();
    try {
      const allValues = Array.from(this.data.values());
      const total = allValues.length;
      const data = allValues.slice(offset, offset + limit);

      logger.debug("Storage paginate operation", {
        offset,
        limit,
        total,
        returned: data.length,
      });

      return {
        data,
        total,
        offset,
        limit,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      };
    } finally {
      this.releaseReadLock();
    }
  }
}

module.exports = ThreadSafeStorage;
