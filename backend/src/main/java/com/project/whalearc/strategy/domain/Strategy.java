package com.project.whalearc.strategy.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "strategies")
public class Strategy {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String name;
    private String description;
    private List<Indicator> indicators = new ArrayList<>();
    private List<Condition> entryConditions = new ArrayList<>();
    private List<Condition> exitConditions = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public Strategy(String userId, String name, String description,
                    List<Indicator> indicators,
                    List<Condition> entryConditions,
                    List<Condition> exitConditions) {
        this.userId = userId;
        this.name = name;
        this.description = description;
        this.indicators = indicators != null ? indicators : new ArrayList<>();
        this.entryConditions = entryConditions != null ? entryConditions : new ArrayList<>();
        this.exitConditions = exitConditions != null ? exitConditions : new ArrayList<>();
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}
