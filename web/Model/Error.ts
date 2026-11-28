export default class Error {
    public Date: string;
    public Code: string;
    public Description: string;
    public Status: string;

    constructor(date: string, code: string, description: string, status: string) {
        this.Date = date;
        this.Code = code;
        this.Description = description;
        this.Status = status;
    }
}