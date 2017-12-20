const Tag = require('./Tag.js');
const Log = require('./Log.js');
const fs = require('fs');
const path = require('path');

class TagFactory
{
    static Identify(ATQA, SAK, ATS)
    {
        for (var tag of TagFactory.Tags)
        {
            if (tag.Identify(ATQA, SAK, ATS))
                return tag;
        }

        throw new Error("Could not identify tag type");
    }

    static Register(classname)
    {
        var name = classname.name;

        if (!(new classname instanceof Tag))
            return Log.error("TagFactory::Register(): Class is not instance of Tag", {name});

        TagFactory.Tags.push(classname);

        Log.verbose("TagFactory::Register(): Registered tag", {name});
    }

    static InitializeTypes()
    {
        TagFactory.Tags = [];

        fs.readdir(path.join(__dirname, "Tags"), function(err, files)
        {
            for (var file of files)
            {
                // ./Tags/TypeTag/TypeTag.js
                var filePath = path.join(__dirname, "Tags", file, file + ".js");

                fs.stat(filePath, function(err, stat) {
                    if (!err && stat.isFile())
                    {
                        const classname = require(filePath);
                        TagFactory.Register(classname);
                    }
                });
            }
        });
    }
}

TagFactory.InitializeTypes();

module.exports = TagFactory;
