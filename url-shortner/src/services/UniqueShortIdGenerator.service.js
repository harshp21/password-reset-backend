"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueShortIdGeneratorService = void 0;
var short_unique_id_1 = __importDefault(require("short-unique-id"));
var UniqueShortIdGeneratorService = /** @class */ (function () {
    function UniqueShortIdGeneratorService() {
    }
    UniqueShortIdGeneratorService.prototype.generateUniqueId = function (options) {
        if (options === void 0) { options = {}; }
        var uid = new short_unique_id_1.default(options);
        return uid();
    };
    return UniqueShortIdGeneratorService;
}());
exports.UniqueShortIdGeneratorService = UniqueShortIdGeneratorService;
