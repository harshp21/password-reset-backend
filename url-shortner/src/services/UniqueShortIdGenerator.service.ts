import ShortUniqueId from "short-unique-id";

class UniqueShortIdGeneratorService {

    public generateUniqueId(options = {}): string {
        let uid = new ShortUniqueId(options);
        return uid();
    }
}

export { UniqueShortIdGeneratorService };